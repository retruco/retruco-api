// Retruco-API -- HTTP API to bring out shared positions from argumented statements
// By: Paula Forteza <paula@retruco.org>
//     Emmanuel Raviart <emmanuel@retruco.org>
//
// Copyright (C) 2016 Paula Forteza & Emmanuel Raviart
// https://git.framasoft.org/retruco/retruco-api
//
// Retruco-API is free software; you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// Retruco-API is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.


import Ajv from "ajv"
import assert from "assert"

import config from "../config"
import {db} from "../database"
import {entryToCard, entryToUser, getObjectFromId, getOrNewLocalizedString, getOrNewProperty, getOrNewValue,
  languageConfigurationNameByCode, newCard, ownsUser, rateStatement, toDataJson, unrateStatement,
  wrapAsyncMiddleware} from "../model"
import {bundleSchemaByPath, schemaByPath} from "../schemas"
import {getIdFromSymbol} from "../symbols"


const ajvStrict = new Ajv({
  // See: https://github.com/epoberezkin/ajv#options
  allErrors: true,
  format: "full",
  formats: {
    uriref: /^\d+$/,
  },
  unknownFormats: true,
  verbose: true,
})
for (let [path, schema] of Object.entries(schemaByPath)) {
  ajvStrict.addSchema(schema, path)
}

const ajvStrictForBundle = new Ajv({
  // See: https://github.com/epoberezkin/ajv#options
  allErrors: true,
  format: "full",
  formats: {
    uriref: () => true,  // Accept every string.
  },
  unknownFormats: true,
  verbose: true,
})
for (let [path, schema] of Object.entries(bundleSchemaByPath)) {
  ajvStrictForBundle.addSchema(schema, path)
}

const ajvWithCoercion = new Ajv({
  // See: https://github.com/epoberezkin/ajv#options
  allErrors: true,
  coerceTypes: "array",
  format: "full",
  formats: {
    uriref: {
      async: true,
      validate: async function validateUriref(statementId) {
        return (await db.one("SELECT EXISTS (SELECT 1 FROM statements WHERE id = $1)", statementId)).exists
      },
    },
  },
  unknownFormats: true,
  verbose: true,
})
for (let [path, schema] of Object.entries(schemaByPath)) {
  ajvWithCoercion.addSchema(schema, path)
}

const ajvWithCoercionForBundle = new Ajv({
  // See: https://github.com/epoberezkin/ajv#options
  allErrors: true,
  coerceTypes: "array",
  format: "full",
  formats: {
    uriref: () => true,  // Accept every string.
  },
  unknownFormats: true,
  verbose: true,
})
for (let [path, schema] of Object.entries(bundleSchemaByPath)) {
  ajvWithCoercionForBundle.addSchema(schema, path)
}


export const bundleCards = wrapAsyncMiddleware(async function bundleCards(req, res) {
  let user = req.authenticatedUser
  let userId = user ? user.id : null
  let bundle = req.body
  let language = bundle.language
  let keyName = bundle.key

  //
  // Validate input.
  //

  // Validate given schemas (if any).
  let schemaErrorsByName = {}
  for (let [name, schema] of Object.entries(bundle.schemas || {})) {
    try {
      ajvStrictForBundle.compile(schema)
    } catch (e) {
      schemaErrorsByName[name] = e.message
      continue
    }
    if (schema.type === "array" && Array.isArray(schema.items)) {
      schemaErrorsByName[name] = "In a bundle, a schema of type array must not use an array to define its items."
    }
  }
  let schemasName = Object.keys(bundle.schemas || {})

  // Validate given widgets (if any).
  // TODO
  let widgetErrorsByName = {}
  // for (let [name, widget] of (Object.entries(bundle.widgets || {}))) {
  for (let name of (Object.keys(bundle.widgets || {}))) {
    if (!schemasName.includes(name)) widgetErrorsByName[name] = `Missing schema for widget "${name}"`
  }

  let errorMessages = {}
  if (Object.keys(schemaErrorsByName).length > 0) errorMessages["schemas"] = schemaErrorsByName
  if (Object.keys(widgetErrorsByName).length > 0) errorMessages["widgets"] = widgetErrorsByName
  if (Object.keys(errorMessages).length > 0) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400,  // Bad Request
      errors: errorMessages,
      message: "Errors detected in schemas and/or widgets definitions.",
    })
    return
  }

  let fieldByName = {}
  for (let [name, schema] of Object.entries(bundle.schemas || {})) {
    // If schema is for an array, only keep the schema of its items.
    if (schema.type === "array") {
      schema = schema.items
    }
    fieldByName[name] = {
      maxLength: 0,
      schema,
      widget: {},
    }
  }
  for (let [name, widget] of Object.entries(bundle.widgets || {})) {
    fieldByName[name]["widget"] = widget
  }

  // Guess schema and widget of each attribute.
  for (let attributes of bundle.cards) {
    for (let [name, value] of Object.entries(attributes)) {
      let values = Array.isArray(value) ? value : [value]
      let {maxLength, schema, widget} = fieldByName[name] || {
        maxLength: 0,
        schema: {},
        widget: {},
      }
      if (values.length > maxLength) maxLength = values.length
      for (value of values) {
        let valueType = typeof value
        if (valueType == "string") {
          let numberValue = Number(value)
          if (!Number.isNaN(numberValue)) {
            value = numberValue
            valueType = "number"
          }
        }

        if (valueType === "boolean") {
          if (!schema.type) schema = {type: "boolean"}
          if (schema.type === "boolean") {
            if (widget.tag !== "input" || widget.type !== "checkbox") widget = {tag: "input", type: "checkbox"}
          }
        } else if (valueType === "number") {
          if (!schema.type || schema.type === "boolean") schema = {type: "number"}
          if (schema.type === "number") {
            if (widget.tag !== "input" || widget.type !== "number") widget = {tag: "input", type: "number"}
          }
        } else if (valueType === "string") {
          if (schema.$ref !== "/schemas/localized-string" && schema.type !== "string") {
            schema = {$ref: "/schemas/localized-string"}
          }
          if (value.includes("\n")) {
            if (widget.tag !== "textarea") widget = {tag: "textarea"}
          } else {
            if (widget.tag !== "textarea" && (widget.tag !== "input" || widget.type !== "text")) {
              widget = {tag: "input", type: "text"}
            }
          }
        }
      }
      fieldByName[name] = {maxLength, schema, widget}
    }
  }

  let schemaValidator = ajvWithCoercionForBundle.compile({
    type: "object",
    properties: Object.entries(fieldByName).reduce((schemaByName, [name, {schema}]) => {
      schemaByName[name] = {
        anyOf: [
          schema,
          {
            items: schema,
            type: "array",
          },
        ],
      }
      return schemaByName
    }, {}),
  })
  let cardErrorsByKeyValue = {}
  for (let attributes of bundle.cards) {
    if (!schemaValidator(attributes)) cardErrorsByKeyValue[attributes[keyName]] = schemaValidator.errors
  }
  if (Object.keys(cardErrorsByKeyValue).length > 0) errorMessages["cards"] = cardErrorsByKeyValue
  if (Object.keys(errorMessages).length > 0) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400,  // Bad Request
      errors: errorMessages,
      message: "Errors detected in given cards.",
    })
    return
  }

  //
  // Retrieve IDs of existing statements rated by user.
  //

  let inactiveStatementIds = new Set((await db.any(
    `
      SELECT objects.id FROM objects
      INNER JOIN statements ON objects.id = statements.id
      WHERE statements.id IN (SELECT statement_id FROM ballots WHERE voter_id = $1)
    `,
    userId,
  )).map(entry => entry.id))

  //
  // Convert input cards
  //

  let idByStringCache = {}
  let objectSchemaId = getIdFromSymbol("/types/object")

  async function getOrNewIdFromString(typedLanguage, string, {inactiveStatementIds = null, properties = null,
    userId = null} = {}) {
    assert.strictEqual(typeof string, "string")
    let id = idByStringCache[string]
    if (id !== undefined) {
      assert(!isNaN(parseInt(id)), `Ìnvalid id "${id}" for string "${string}".`)
      return id
    }
    id = (await getOrNewLocalizedString(typedLanguage, string, {inactiveStatementIds, properties, userId})).id
    assert(!isNaN(parseInt(id)), `Ìnvalid id "${id}" for string "${string}".`)
    idByStringCache[string] = id
    return id
  }

  async function getOrNewIdFromSchemaWidgetValue(schema, widget, value, {inactiveStatementIds = null, properties = null,
    userId = null} = {}) {
    let schemaString = JSON.stringify({
      schemaId: objectSchemaId,
      value: schema,
      widgetId: null,
    })
    let schemaId = idByStringCache[schemaString]
    if (schemaId === undefined) {
      schemaId = (await getOrNewValue(objectSchemaId, null, schema, {inactiveStatementIds, userId})).id
      idByStringCache[schemaString] = schemaId
    }

    let widgetId = null
    if (widget) {
      let widgetString = JSON.stringify({
        schemaId: objectSchemaId,
        value: widget,
        widgetId: null,
      })
      widgetId = idByStringCache[widgetString]
      if (widgetId === undefined) {
        widgetId = (await getOrNewValue(objectSchemaId, null, widget, {inactiveStatementIds, userId})).id
        idByStringCache[widgetString] = widgetId
      }
    }

    let valueString =  JSON.stringify({
      schemaId,
      value,
      widgetId,
    })
    let valueId = idByStringCache[valueString]
    if (valueId === undefined) {
      valueId = (await getOrNewValue(schemaId, widgetId, value, {inactiveStatementIds, properties, userId})).id
      idByStringCache[valueString] = valueId
    }
    return valueId
  }

  async function simplifyFieldValue(cardWarningsByKeyValue, keyValue, name, field, value, {
    inactiveStatementIds = null,
    userId = null,
  } = {}) {
    // Simplify value and schema of attribute.
    let {maxLength, schema, widget} = field
    if (maxLength > 1) {
      if (!Array.isArray(value)) {
        schema = schema.items
      } else if (value.length === 0) {
        schema = {type: null}
        value = null
      } else if (value.length === 1) {
        schema = schema.items
        value = value[0]
      }
    } else if (Array.isArray(value)) {
      if (value.length > 0) {
        value = value[0]
      } else {
        schema = {type: null}
        value = null
      }
    }
    if (schema.$ref === "/schemas/bijective-uri-reference") {
      let referencedCardId = cardIdByKeyValue[value.targetId]
      if (referencedCardId === undefined) {
        let cardWarnings = cardWarningsByKeyValue[keyValue]
        if (cardWarnings === undefined) cardWarningsByKeyValue[keyValue] = cardWarnings = {}
        cardWarnings[name] = `Unknown key "${value.targetId}" for referenced card.`
        value = value.targetId

        schema = {type: "string"}
        // TODO: Change widget.
      } else {
        value.targetId = referencedCardId
        let reverseName = value.reverseKeyId
        let reverseNameId = await getOrNewIdFromString(typedLanguage, reverseName, {inactiveStatementIds, userId})
        value.reverseKeyId = reverseNameId
      }
    } else if (schema.type === "array" && schema.items.$ref === "/schemas/bijective-uri-reference") {
      let items = []
      for (let [index, item] of value.entries()) {
        let referencedCardId = cardIdByKeyValue[item.targetId]
        if (referencedCardId === undefined) {
          let cardWarnings = cardWarningsByKeyValue[keyValue]
          if (cardWarnings === undefined) cardWarningsByKeyValue[keyValue] = cardWarnings = {}
          let attributeWarnings = cardWarnings[name]
          if (attributeWarnings === undefined) cardWarnings[name] = attributeWarnings = {}
          attributeWarnings[String(index)] = `Unknown key "${item.targetId}" for referenced card`
          item = item.targetId

          schema = Object.assign({}, schema)
          if (Array.isArray(schema.items)) schema.items = [...schema.items]
          else schema.items = value.map(() => Object.assign({}, schema.items))
          schema.items[index] = {type: "string"}
          // TODO: Change widget.
        } else {
          item.targetId = referencedCardId
          let reverseName = item.reverseKeyId
          let reverseNameId = await getOrNewIdFromString(typedLanguage, reverseName, {inactiveStatementIds, userId})
          item.reverseKeyId = reverseNameId
        }
        items.push(item)
      }
      value = items
    } else if (schema.$ref === "/schemas/localized-string") {
      if (typeof value === "string") {
        value = {[language]: value}
      }
    } else if (schema.type === "array" && schema.items.$ref === "/schemas/localized-string") {
      value = value.map(item => {
        if (typeof item === "string") {
          item = {[language]: item}
        }
        return item
      })
    } else if (schema.type === "string" && schema.format === "uriref") {
      let referencedCardId = cardIdByKeyValue[value]
      if (referencedCardId === undefined) {
        let cardWarnings = cardWarningsByKeyValue[keyValue]
        if (cardWarnings === undefined) cardWarningsByKeyValue[keyValue] = cardWarnings = {}
        cardWarnings[name] = `Unknown key "${value}" for referenced card.`

        schema = {type: "string"}
        // TODO: Change widget.
      } else {
        value = referencedCardId
      }
    } else if (schema.type === "array" && schema.items.type === "string" && schema.items.format === "uriref") {
      let items = []
      for (let [index, item] of value.entries()) {
        let referencedCardId = cardIdByKeyValue[item]
        if (referencedCardId === undefined) {
          let cardWarnings = cardWarningsByKeyValue[keyValue]
          if (cardWarnings === undefined) cardWarningsByKeyValue[keyValue] = cardWarnings = {}
          let attributeWarnings = cardWarnings[name]
          if (attributeWarnings === undefined) cardWarnings[name] = attributeWarnings = {}
          attributeWarnings[String(index)] = `Unknown key "${item}" for referenced card`

          schema = Object.assign({}, schema)
          if (Array.isArray(schema.items)) schema.items = [...schema.items]
          else schema.items = value.map(() => Object.assign({}, schema.items))
          schema.items[index] = {type: "string"}
          // TODO: Change widget.
        } else {
          item = referencedCardId
        }
        items.push(item)
      }
      value = items
    }
    return [schema, widget, value]
  }

  for (let field of Object.values(fieldByName)) {
    if (field.maxLength > 1) {
      field.schema = {
        items: field.schema,
        type: "array",
      }
      // field.widget = {
      //   items: field.widget,
      //   tag: "array",
      // }
    }
  }

  // Upsert and rate all cards using only keyName to retrieve them.
  let cardIdByKeyValue = {}
  let cardWarningsByKeyValue = {}
  let typedLanguage = await getObjectFromId(getIdFromSymbol(`localization.${language}`))
  let keyNameId = await getOrNewIdFromString(typedLanguage, keyName, {inactiveStatementIds, userId})
  for (let attributes of bundle.cards) {
    let keyValue = attributes[keyName]
    let [keySchema, keyWidget, simplifiedKeyValue] = await simplifyFieldValue(cardWarningsByKeyValue, keyValue,
      keyName, fieldByName[keyName], attributes[keyName], {inactiveStatementIds, userId})
    let keyValueId = await getOrNewIdFromSchemaWidgetValue(keySchema, keyWidget, simplifiedKeyValue,
      {inactiveStatementIds, userId})

    // Try to retrieve a card rated by user and having key property rated by user.
    let card = entryToCard(await db.oneOrNone(
      `
        SELECT objects.*, statements.*, cards.*, symbol
        FROM objects
        INNER JOIN statements ON objects.id = statements.id
        INNER JOIN cards ON statements.id = cards.id
        LEFT JOIN symbols ON objects.id = symbols.id
        WHERE objects.id IN (
          SELECT object_id
          FROM objects
          INNER JOIN statements ON objects.id = statements.id
          INNER JOIN properties ON statements.id = properties.id
          WHERE key_id = $<keyNameId>
          AND value_id = $<keyValueId>
          AND statements.id IN (SELECT statement_id FROM ballots WHERE voter_id = $<userId>)
        )
        AND statements.id IN (SELECT statement_id FROM ballots WHERE voter_id = $<userId>)
        ORDER BY rating DESC, cards.id
        LIMIT 1
      `,
      {
        keyNameId,
        keyValueId,
        userId,
      },
    ))
    if (card === null) {
      // Try to retrieve a card having key property.
      card = entryToCard(await db.oneOrNone(
        `
          SELECT objects.*, statements.*, cards.*, symbol
          FROM objects
          INNER JOIN statements ON objects.id = statements.id
          INNER JOIN cards ON statements.id = cards.id
          LEFT JOIN symbols ON objects.id = symbols.id
          WHERE objects.id IN (
            SELECT object_id
            FROM objects
            INNER JOIN statements ON objects.id = statements.id
            INNER JOIN properties ON statements.id = properties.id
            WHERE key_id = $<keyNameId>
            AND value_id = $<keyValueId>
          )
          ORDER BY rating DESC, cards.id
          LIMIT 1
        `,
        {
          keyNameId,
          keyValueId,
          userId,
        },
      ))
    }
    if (card === null) {
      card = await newCard({
        inactiveStatementIds,
        properties: {[keyNameId]: keyValueId},
        userId,
      })
    } else {
      await rateStatement(card.id, userId, 1)
      inactiveStatementIds.delete(card.id)
    }
    cardIdByKeyValue[keyValue] = card.id
  }

  for (let attributes of bundle.cards) {
    let keyValue = attributes[keyName]
    let cardId = cardIdByKeyValue[keyValue]
    assert.notStrictEqual(cardId, undefined)

    for (let [name, value] of Object.entries(attributes)) {
      // Convert attribute name to a typed value.
      let nameId = await getOrNewIdFromString(typedLanguage, name, {inactiveStatementIds, userId})

      // Convert attribute value to a typed value, after simplifying it and replacing names with IDs.
      let schema, widget
      [schema, widget, value] = await simplifyFieldValue(cardWarningsByKeyValue, keyValue, name, fieldByName[name],
        value, {inactiveStatementIds, userId})
      let valueId = await getOrNewIdFromSchemaWidgetValue(schema, widget, value, {inactiveStatementIds, userId})

      await getOrNewProperty(cardId, nameId, valueId, {inactiveStatementIds, userId})
    }
  }

  // Remove obsolete user ratings.
  console.log("inactiveStatementIds:", inactiveStatementIds.size)
  for (let statementId of inactiveStatementIds) {
    // console.log("Removing inactive statement:", await getObjectFromId(statementId))
    await unrateStatement(statementId, userId)
  }

  let result = {
    apiVersion: "1",
  }
  let warningMessages = {}
  if (Object.keys(cardWarningsByKeyValue).length > 0) warningMessages["cards"] = cardWarningsByKeyValue
  if (Object.keys(warningMessages).length > 0) result.warnings = warningMessages
  res.json(result)
})


export const createCardEasy = wrapAsyncMiddleware(async function createCardEasy(req, res) {
  // Create a new card, giving its initial attributes, schemas & widgets.
  let authenticatedUser = req.authenticatedUser
  let cardInfos = req.body
  let language = cardInfos.language
  let show = req.query.show || []
  let userId = authenticatedUser.id

  // Validate given schemas.
  let schemaErrorsByName = {}
  for (let [name, schema] of Object.entries(cardInfos.schemas || {})) {
    try {
      ajvStrict.compile(schema)
    } catch (e) {
      schemaErrorsByName[name] = e.message
    }
  }
  let schemasName = Object.keys(cardInfos.schemas || {})

  // Validate given widgets.
  // TODO
  let widgetErrorsByName = {}
  // for (let [name, widget] of (Object.entries(cardInfos.widgets || {}))) {
  for (let name of (Object.keys(cardInfos.widgets || {}))) {
    if (!schemasName.includes(name)) widgetErrorsByName[name] = `Missing schema for widget "${name}"`
  }

  let errorMessages = {}
  if (Object.keys(schemaErrorsByName).length > 0) errorMessages["schemas"] = schemaErrorsByName
  if (Object.keys(widgetErrorsByName).length > 0) errorMessages["widgets"] = widgetErrorsByName
  if (Object.keys(errorMessages).length > 0) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400,  // Bad Request
      errors: errorMessages,
      message: "Errors detected in schemas and/or widgets definitions.",
    })
    return
  }

  let schemaValidator = ajvWithCoercion.compile({
    type: "object",
    properties: cardInfos.schemas,
  })
  if (!schemaValidator(cardInfos.values)) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400,  // Bad Request
      errors: {values: schemaValidator.errors},
      message: "Errors detected in given values.",
    })
    return
  }

  // Create new card with its properties.
  let inactiveStatementIds = null  // No existings objects to remove when creating a new card.
  let properties = {}
  let typedLanguage = await getObjectFromId(getIdFromSymbol(`localization.${language}`))
  for (let [name, value] of Object.entries(cardInfos.value)) {
    // Convert attribute name to a typed value.
    let nameId = await getOrNewLocalizedString(typedLanguage, name, {inactiveStatementIds, userId})
    let schemaId = (await getOrNewValue(getIdFromSymbol("/types/object"), null, cardInfos.schemas[name],
      {inactiveStatementIds, userId})).id
    let widget = cardInfos.widgets[name]
    let widgetId = null
    if (widget) {
      widgetId = (await getOrNewValue(getIdFromSymbol("/types/object"), null, widget,
        {inactiveStatementIds, userId})).id
    }
    let valueId = (await getOrNewValue(schemaId, widgetId, value, {inactiveStatementIds, userId})).id
    properties[nameId] = valueId
  }
  let card = await newCard({
    inactiveStatementIds,
    properties,
    userId,
  })

  res.status(201)  // Created
  res.json({
    apiVersion: "1",
    data: await toDataJson(card, authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showValues: show.includes("values"),
    }),
  })
})


export const listCards = wrapAsyncMiddleware(async function listCards(req, res) {
  // Respond a list of statements.
  let authenticatedUser = req.authenticatedUser
  let language = req.query.language
  let limit = req.query.limit || 20
  let offset = req.query.offset || 0
  let show = req.query.show || []
  let subTypes = req.query.type || []
  let tags = req.query.tag || []
  let term = req.query.term
  let userName = req.query.user  // email or urlName

  let user = null
  if (userName) {
    if (!authenticatedUser) {
      res.status(401)  // Unauthorized
      res.json({
        apiVersion: "1",
        code: 401,  // Unauthorized
        message: "The statements of a user can only be retrieved by the user himself or an admin.",
      })
      return
    }

    if (userName.indexOf("@") >= 0) {
      user = entryToUser(await db.oneOrNone(
        `SELECT * FROM objects
          INNER JOIN users ON objects.id = users.id
          WHERE email = $1
        `, userName))
      if (user === null) {
        res.status(404)
        res.json({
          apiVersion: "1",
          code: 404,
          message: `No user with email "${userName}".`,
        })
        return
      }
    } else {
      user = entryToUser(await db.oneOrNone(
        `SELECT * FROM objects
          INNER JOIN users ON objects.id = users.id
          WHERE url_name = $1
        `, userName))
      if (user === null) {
        res.status(404)
        res.json({
          apiVersion: "1",
          code: 404,
          message: `No user named "${userName}".`,
        })
        return
      }
    }

    if (!ownsUser(authenticatedUser, user)) {
      res.status(403)  // Forbidden
      res.json({
        apiVersion: "1",
        code: 403,  // Forbidden
        message: "The statements of a user can only be retrieved by the user himself or an admin.",
      })
      return
    }
  }

  let whereClauses = []

  // if (language) {
  //   whereClauses.push("data->>'language' = $<language> OR data->'language' IS NULL")
  // }

  if (subTypes.length > 0) {
    whereClauses.push("sub_types && $<subTypes>")
  }

  if (tags.length > 0) {
    whereClauses.push("tags @> $<tags:json>")
  }

  if (term) {
    term = term.trim()
    if (term) {
      let languages = language ? [language] : config.languages
      let termClauses = languages.map( language =>
        `objects.id IN (
          SELECT id
          FROM cards_text_search
          WHERE text_search @@ plainto_tsquery('${languageConfigurationNameByCode[language]}', $<term>)
          AND configuration_name = '${languageConfigurationNameByCode[language]}'
        )`
      )
      if (termClauses.length === 1) {
        whereClauses.push(termClauses[0])
      } else if (termClauses.length > 1) {
        let termClause = termClauses.join(" OR ")
        whereClauses.push(`(${termClause})`)
      }
    }
  }

  if (user !== null) {
    whereClauses.push("statements.id IN (SELECT statement_id FROM ballots WHERE voter_id = $<userId>)")
  }

  let whereClause = whereClauses.length === 0 ? "" : "WHERE " + whereClauses.join(" AND ")

  let coreArguments = {
    // language,
    subTypes,
    tags: tags.map(tag => ({[language || "en"]: tag})),
    term,
    userId: user === null ? null : user.id,
  }
  let count = (await db.one(
    `
      SELECT count(*) as count
      FROM objects
      INNER JOIN statements on objects.id = statements.id
      INNER JOIN cards on statements.id = cards.id
      ${whereClause}
    `,
    coreArguments,
  )).count

  let cards = (await db.any(
    `
      SELECT objects.*, statements.*, cards.*, symbol
      FROM objects
      INNER JOIN statements on objects.id = statements.id
      INNER JOIN cards on statements.id = cards.id
      LEFT JOIN symbols ON objects.id = symbols.id
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $<limit>
      OFFSET $<offset>
    `,
    Object.assign({}, coreArguments, {
      limit,
      offset,
    }),
  )).map(entryToCard)

  res.json({
    apiVersion: "1",
    count: count,
    data: await toDataJson(cards, authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showValues: show.includes("values"),
    }),
    limit: limit,
    offset: offset,
  })
})


export const listTagsPopularity = wrapAsyncMiddleware(async function listTagsPopularity(req, res) {
  let language = req.query.language
  let limit = req.query.limit || 20
  let offset = req.query.offset || 0
  let subTypes = req.query.type || []
  let tags = req.query.tag || []

  let whereClauses = [
    "type = 'Card'",
  ]

  // if (language) {
  //   whereClauses.push("data->>'language' = $<language> OR data->'language' IS NULL")
  // }

  if (subTypes.length > 0) {
    whereClauses.push("sub_types && $<subTypes>")
  }

  if (tags.length > 0) {
    whereClauses.push("tags @> $<tags:json>")
  }

  let whereClause = whereClauses.length === 0 ? "" : "WHERE " + whereClauses.join(" AND ")

  let coreArguments = {
    // language,
    subTypes,
    tags: tags.map(tag => ({[language || "en"]: tag})),
  }
  let count = (await db.one(
    `
      SELECT count(*)
      FROM (
        SELECT DISTINCT jsonb_array_elements(tags) as count
        FROM objects
        ${whereClause}
      ) AS distinct_tags
    `,
    coreArguments,
  )).count

  let popularity = (await db.any(
    `
      SELECT jsonb_array_elements(tags)->>'en' AS tag, count(id) as count
      FROM objects
      ${whereClause}
      GROUP BY tag
      ORDER BY count DESC
      LIMIT $<limit>
      OFFSET $<offset>
    `,
    Object.assign({}, coreArguments, {
      limit,
      offset,
    }),
  )).filter(entry => !tags.includes(entry.tag))

  res.json({
    apiVersion: "1",
    count: count,
    data: popularity,
    limit: limit,
    offset: offset,
  })
})
