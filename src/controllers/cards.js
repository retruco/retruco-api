// Retruco-API -- HTTP API to bring out shared positions from argumented statements
// By: Paula Forteza <paula@retruco.org>
//     Emmanuel Raviart <emmanuel@retruco.org>
//
// Copyright (C) 2016, 2017 Paula Forteza & Emmanuel Raviart
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
import { db } from "../database"
import {
  convertValidJsonToExistingOrNewTypedValue,
  entryToCard,
  entryToUser,
  getObjectFromId,
  getOrNewLocalizedString,
  getOrNewProperty,
  languageConfigurationNameByCode,
  newCard,
  ownsUser,
  rateStatement,
  toDataJson,
  toObjectJson,
  unrateStatementId,
  wrapAsyncMiddleware,
} from "../model"
import { bundleSchemaByPath, schemaByPath } from "../schemas"
import { getIdFromIdOrSymbol, getIdFromSymbol, getIdOrSymbolFromId } from "../symbols"

const ajvStrict = new Ajv({
  // See: https://github.com/epoberezkin/ajv#options
  allErrors: true,
  format: "full",
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
  unknownFormats: true,
  verbose: true,
})
for (let [path, schema] of Object.entries(bundleSchemaByPath)) {
  ajvWithCoercionForBundle.addSchema(schema, path)
}

export const autocompleteCards = wrapAsyncMiddleware(async function autocompleteCards(req, res) {
  let language = req.query.language
  let limit = req.query.limit || 20
  let subTypes = req.query.type || []
  let subTypeIds = subTypes.map(getIdFromIdOrSymbol).filter(subTypeId => subTypeId)
  let tags = req.query.tag || []
  let tagIds = tags.map(getIdFromIdOrSymbol).filter(tag => tag)
  let term = req.query.term

  let whereClauses = []

  if (language) {
    whereClauses.push("$<language> = ANY(languages_sets.languages)")
  }

  if (subTypeIds.length > 0) {
    whereClauses.push("sub_types && $<subTypeIds>")
  }

  if (tagIds.length > 0) {
    whereClauses.push("tags @> $<tagIds>")
  }

  let whereClause = whereClauses.length === 0 ? "" : "WHERE " + whereClauses.join(" AND ")

  // The DISTINCT below is needed when language is not specified (=> several cards_autocomplete for the same object).
  let entries = await db.any(
    `
      SELECT DISTINCT objects.*, statements.*, cards.*, cards_autocomplete.autocomplete,
        cards_autocomplete.autocomplete <-> $<term> AS distance
      FROM objects
      INNER JOIN statements ON objects.id = statements.id
      INNER JOIN cards ON statements.id = cards.id
      INNER JOIN cards_autocomplete ON cards.id = cards_autocomplete.id
      INNER JOIN languages_sets ON cards_autocomplete.languages_set_id = languages_sets.id
      ${whereClause}
      ORDER BY distance
      LIMIT $<limit>
    `,
    {
      language,
      limit,
      subTypeIds,
      tagIds,
      term: term || "",
    },
  )

  let autocompletions = []
  for (let entry of entries) {
    let autocomplete = entry.autocomplete
    delete entry.autocomplete
    let distance = entry.distance
    delete entry.distance
    autocompletions.push({
      autocomplete,
      card: await toObjectJson(await entryToCard(entry)),
      distance,
    })
  }

  res.json({
    apiVersion: "1",
    data: autocompletions,
  })
})

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
    if (typeof schema === "string") {
      let schemaId = getIdFromIdOrSymbol(schema)
      schema = (await getObjectFromId(schemaId)).value
      if (schema === undefined) {
        schemaErrorsByName[name] = `Ùnknown schema: "${schemaId}".`
        continue
      }
      bundle.schemas[name] = schema
    }
    try {
      ajvStrictForBundle.compile(schema)
    } catch (e) {
      schemaErrorsByName[name] = e.message
      continue
    }
    if (name === "id" && schema.$ref !== "/schemas/card-id") {
      schemaErrorsByName[name] = "Invalid schema for an ID"
    } else if (schema.type === "array" && Array.isArray(schema.items)) {
      schemaErrorsByName[name] = "In a bundle, a schema of type array must not use an array to define its items."
    }
  }
  let schemasName = Object.keys(bundle.schemas || {})

  // Validate given widgets (if any).
  let widgetErrorsByName = {}
  for (let [name, widget] of Object.entries(bundle.widgets || {})) {
    if (typeof widget === "string") {
      let widgetId = getIdFromIdOrSymbol(widget)
      widget = (await getObjectFromId(widgetId)).value
      if (widget === undefined) {
        widgetErrorsByName[name] = `Ùnknown widget: "${widgetId}".`
        continue
      }
      bundle.widgets[name] = widget
    }
    // TODO
    if (!schemasName.includes(name)) widgetErrorsByName[name] = `Missing schema for widget "${name}"`
  }

  let errorMessages = {}
  if (Object.keys(schemaErrorsByName).length > 0) errorMessages["schemas"] = schemaErrorsByName
  if (Object.keys(widgetErrorsByName).length > 0) errorMessages["widgets"] = widgetErrorsByName
  if (Object.keys(errorMessages).length > 0) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400, // Bad Request
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
      let { maxLength, schema, widget } = fieldByName[name] || {
        maxLength: 0,
        schema: name === "id" ? { $ref: "/schemas/card-id" } : {},
        widget: {},
      }
      if (values.length > maxLength) maxLength = values.length
      for (value of values) {
        let valueType = typeof value
        if (valueType === "string") {
          let numberValue = Number(value)
          if (!Number.isNaN(numberValue)) {
            value = numberValue
            valueType = "number"
          }
        }

        if (valueType === "boolean") {
          if (!schema.$ref && !schema.type) schema = { type: "boolean" }
          if (schema.type === "boolean") {
            if (widget.tag !== "input" || widget.type !== "checkbox") widget = { tag: "input", type: "checkbox" }
          }
        } else if (valueType === "number") {
          if (!["/schemas/card-id", "/schemas/value-id"].includes(schema.$ref)) {
            if ((!schema.$ref && !schema.type) || schema.type === "boolean") schema = { type: "number" }
            if (schema.type === "number") {
              if (widget.tag !== "input" || widget.type !== "number") widget = { tag: "input", type: "number" }
            }
          }
        } else if (valueType === "string") {
          if (!["/schemas/card-id", "/schemas/value-id"].includes(schema.$ref)) {
            if (schema.$ref !== "/schemas/localized-string" && schema.type !== "string") {
              schema = { $ref: "/schemas/localized-string" }
            }
            if (value.includes("\n")) {
              if (widget.tag !== "textarea") widget = { tag: "textarea" }
            } else {
              if (
                widget.tag !== "textarea" && (widget.tag !== "input" || !["email", "text", "url"].includes(widget.type))
              ) {
                widget = { tag: "input", type: "text" }
              }
            }
          }
        }
      }
      fieldByName[name] = { maxLength, schema, widget }
    }
  }

  if (fieldByName[keyName] === undefined) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400, // Bad Request
      message: `"key" value must be the name of an attribute of cards: Was: ${keyName}`,
    })
    return
  }

  let idField = fieldByName["id"]
  if (idField !== undefined && idField.schema.$ref !== "/schemas/card-id") {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400, // Bad Request
      message: `"id" attribute of cards must be of type "card-id". Was: ${JSON.stringify(idField.schema, null, 2)}`,
    })
    return
  }

  let schemaValidator = ajvWithCoercionForBundle.compile({
    type: "object",
    properties: Object.entries(fieldByName).reduce((schemaByName, [name, { schema }]) => {
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
      code: 400, // Bad Request
      errors: errorMessages,
      message: "Errors detected in given cards.",
    })
    return
  }

  //
  // Retrieve IDs of existing statements rated by user.
  //

  let inactiveStatementIds = new Set(
    (await db.any(
      `
      SELECT objects.id FROM objects
      INNER JOIN statements ON objects.id = statements.id
      WHERE statements.id IN (SELECT statement_id FROM ballots WHERE voter_id = $1)
    `,
      userId,
    )).map(entry => entry.id),
  )

  //
  // Convert input cards.
  //

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
  let cache = {}
  let cardIdByKeyValue = {}
  let cardWarningsByKeyValue = {}
  let keyNameId = keyName === "id"
    ? null
    : (await getOrNewLocalizedString(language, keyName, "widget:input-text", { cache, inactiveStatementIds, userId }))
        .id
  for (let attributes of bundle.cards) {
    let keyValue = attributes[keyName]
    let card = null
    if (keyName === "id") {
      card = entryToCard(
        await db.oneOrNone(
          `
          SELECT objects.*, statements.*, cards.*, symbol
          FROM objects
          INNER JOIN statements ON objects.id = statements.id
          INNER JOIN cards ON statements.id = cards.id
          LEFT JOIN symbols ON objects.id = symbols.id
          WHERE objects.id  = $<keyValue>
          LIMIT 1
        `,
          {
            keyValue,
          },
        ),
      )
      assert.notStrictEqual(card, null)
      await rateStatement(card, userId, 1)
      inactiveStatementIds.delete(card.id)
    } else {
      let keyTypedValue = await getOrNewTypedValueFromBundleField(
        cardIdByKeyValue,
        cardWarningsByKeyValue,
        language,
        keyValue,
        keyName,
        fieldByName[keyName],
        attributes[keyName],
        { cache, inactiveStatementIds, userId },
      )
      if (keyTypedValue === null) continue
      let keyValueId = keyTypedValue.id

      // Try to retrieve a card rated by user and having key property rated by user.
      card = entryToCard(
        await db.oneOrNone(
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
          ORDER BY rating_sum DESC, cards.id
          LIMIT 1
        `,
          {
            keyNameId,
            keyValueId,
            userId,
          },
        ),
      )
      if (card === null) {
        // Try to retrieve a card having key property.
        card = entryToCard(
          await db.oneOrNone(
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
            ORDER BY rating_sum DESC, cards.id
            LIMIT 1
          `,
            {
              keyNameId,
              keyValueId,
              userId,
            },
          ),
        )
      }
      if (card === null) {
        card = await newCard({
          inactiveStatementIds,
          properties: { [keyNameId]: keyValueId },
          userId,
        })
      } else {
        await rateStatement(card, userId, 1)
        inactiveStatementIds.delete(card.id)
      }
    }
    cardIdByKeyValue[keyValue] = card.id
  }

  for (let attributes of bundle.cards) {
    let keyValue = attributes[keyName]
    let cardId = cardIdByKeyValue[keyValue]
    assert.notStrictEqual(cardId, undefined)

    for (let [name, value] of Object.entries(attributes)) {
      if (name === "id") continue

      // Convert attribute name to a typed value.
      let nameId = (await getOrNewLocalizedString(language, name, "widget:input-text", {
        cache,
        inactiveStatementIds,
        userId,
      })).id

      // Convert attribute value to a typed value, after simplifying it and replacing names with IDs.
      let typedValue = await getOrNewTypedValueFromBundleField(
        cardIdByKeyValue,
        cardWarningsByKeyValue,
        language,
        keyValue,
        name,
        fieldByName[name],
        value,
        { cache, inactiveStatementIds, userId },
      )
      if (typedValue === null) continue
      await getOrNewProperty(cardId, nameId, typedValue.id, 1, { inactiveStatementIds, userId })
    }
  }

  // Remove obsolete user ratings.
  for (let statementId of inactiveStatementIds) {
    // console.log("Removing inactive statement:", await describe(await getObjectFromId(statementId)))
    await unrateStatementId(statementId, userId)
  }
  console.log("Number of inactiveStatementIds:", inactiveStatementIds.size)

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
  let schemaIdByName = {}
  for (let [name, schema] of Object.entries(cardInfos.schemas || {})) {
    if (typeof schema === "string") {
      let schemaId = getIdFromIdOrSymbol(schema)
      schema = (await getObjectFromId(schemaId)).value
      if (schema === undefined) {
        schemaErrorsByName[name] = `Ùnknown schema: "${schemaId}".`
        continue
      }
      schemaIdByName[name] = schemaId
      cardInfos.schemas[name] = schema
    }
    try {
      ajvStrict.compile(schema)
    } catch (e) {
      schemaErrorsByName[name] = e.message
    }
  }
  let schemasName = Object.keys(cardInfos.schemas || {})

  // Validate given widgets.
  let widgetErrorsByName = {}
  let widgetIdByName = {}
  for (let [name, widget] of Object.entries(cardInfos.widgets || {})) {
    if (typeof widget === "string") {
      let widgetId = getIdFromIdOrSymbol(widget)
      widget = (await getObjectFromId(widgetId)).value
      if (widget === undefined) {
        widgetErrorsByName[name] = `Ùnknown widget: "${widgetId}".`
        continue
      }
      widgetIdByName[name] = widgetId
      cardInfos.widgets[name] = widget
    }
    // TODO
    if (!schemasName.includes(name)) widgetErrorsByName[name] = `Missing schema for widget "${name}"`
  }

  let errorMessages = {}
  if (Object.keys(schemaErrorsByName).length > 0) errorMessages["schemas"] = schemaErrorsByName
  if (Object.keys(widgetErrorsByName).length > 0) errorMessages["widgets"] = widgetErrorsByName
  if (Object.keys(errorMessages).length > 0) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400, // Bad Request
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
      code: 400, // Bad Request
      errors: { values: schemaValidator.errors },
      message: "Errors detected in given values.",
    })
    return
  }

  // Create new card with its properties.
  let cache = {}
  let inactiveStatementIds = null // No existings objects to remove when creating a new card.
  let properties = {}
  let warnings = {}
  for (let [name, value] of Object.entries(cardInfos.values)) {
    // Convert attribute name to a typed value.
    let nameId = (await getOrNewLocalizedString(language, name, "widget:input-text", {
      cache,
      inactiveStatementIds,
      userId,
    })).id
    let schema = cardInfos.schemas[name]
    let widget = cardInfos.widgets[name] || null
    let [typedValue, warning] = await convertValidJsonToExistingOrNewTypedValue(schema, widget, value, {
      cache,
      inactiveStatementIds,
      userId,
    })
    if (warning !== null) {
      warnings[name] = warning
    }
    if (typedValue === null) continue
    properties[nameId] = typedValue.id
  }
  let card = await newCard({
    inactiveStatementIds,
    properties,
    userId,
  })

  let result = {
    apiVersion: "1",
    data: await toDataJson(card, authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  }
  if (Object.keys(warnings).length > 0) result.warnings = warnings
  res.status(201) // Created
  res.json(result)
})

async function getOrNewTypedValueFromBundleField(
  cardIdByKeyValue,
  cardWarningsByKeyValue,
  language,
  keyValue,
  name,
  field,
  value,
  { cache = null, inactiveStatementIds = null, userId = null } = {},
) {
  // Simplify value and schema of attribute.
  let { maxLength, schema, widget } = field
  if (maxLength > 1) {
    if (!Array.isArray(value)) {
      schema = schema.items
    } else if (value.length === 0) {
      schema = { type: null }
      value = null
    } else if (value.length === 1) {
      schema = schema.items
      value = value[0]
    }
  } else if (Array.isArray(value)) {
    if (value.length > 0) {
      value = value[0]
    } else {
      schema = { type: null }
      value = null
    }
  }
  if (schema.$ref === "/schemas/bijective-card-reference") {
    let referencedCardId = cardIdByKeyValue[value.targetId]
    if (referencedCardId === undefined) {
      let cardWarnings = cardWarningsByKeyValue[keyValue]
      if (cardWarnings === undefined) cardWarningsByKeyValue[keyValue] = cardWarnings = {}
      cardWarnings[name] = `Unknown key "${value.targetId}" for referenced card.`
      value = value.targetId

      schema = { type: "string" }
      // TODO: Change widget.
    } else {
      value.targetId = referencedCardId
      let reverseName = value.reverseKeyId
      let reverseNameId = (await getOrNewLocalizedString(language, reverseName, "widget:input-text", {
        cache,
        inactiveStatementIds,
        userId,
      })).id
      value.reverseKeyId = reverseNameId
    }
  } else if (schema.type === "array" && schema.items.$ref === "/schemas/bijective-card-reference") {
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
        schema.items[index] = { type: "string" }
        // TODO: Change widget.
      } else {
        item.targetId = referencedCardId
        let reverseName = item.reverseKeyId
        let reverseNameId = (await getOrNewLocalizedString(language, reverseName, "widget:input-text", {
          cache,
          inactiveStatementIds,
          userId,
        })).id
        item.reverseKeyId = reverseNameId
      }
      items.push(item)
    }
    value = items
  } else if (schema.$ref === "/schemas/card-id") {
    let referencedCardId = cardIdByKeyValue[value]
    if (referencedCardId === undefined && !Number.isNaN(Number(value))) {
      referencedCardId = value // Verification that card exists is done below.
    }
    if (referencedCardId === undefined) {
      let cardWarnings = cardWarningsByKeyValue[keyValue]
      if (cardWarnings === undefined) cardWarningsByKeyValue[keyValue] = cardWarnings = {}
      cardWarnings[name] = `Unknown key "${value}" for referenced card.`

      schema = { type: "string" }
      // TODO: Change widget.
    } else {
      value = referencedCardId
    }
  } else if (schema.type === "array" && schema.items.$ref === "/schemas/card-id") {
    let items = []
    for (let [index, item] of value.entries()) {
      let referencedCardId = cardIdByKeyValue[item]
      if (referencedCardId === undefined && !Number.isNaN(Number(item))) {
        referencedCardId = item // Verification that card exists is done below.
      }
      if (referencedCardId === undefined) {
        let cardWarnings = cardWarningsByKeyValue[keyValue]
        if (cardWarnings === undefined) cardWarningsByKeyValue[keyValue] = cardWarnings = {}
        let attributeWarnings = cardWarnings[name]
        if (attributeWarnings === undefined) cardWarnings[name] = attributeWarnings = {}
        attributeWarnings[String(index)] = `Unknown key "${item}" for referenced card`

        schema = Object.assign({}, schema)
        if (Array.isArray(schema.items)) schema.items = [...schema.items]
        else schema.items = value.map(() => Object.assign({}, schema.items))
        schema.items[index] = { type: "string" }
        // TODO: Change widget.
      } else {
        item = referencedCardId
      }
      items.push(item)
    }
    value = items
  } else if (schema.$ref === "/schemas/localized-string") {
    if (typeof value === "string") {
      value = { [language]: value }
    }
  } else if (schema.type === "array" && schema.items.$ref === "/schemas/localized-string") {
    value = value.map(item => {
      if (typeof item === "string") {
        item = { [language]: item }
      }
      return item
    })
  }

  let [typedValue, warning] = await convertValidJsonToExistingOrNewTypedValue(schema, widget, value, {
    inactiveStatementIds,
    userId,
  })
  if (warning !== null) {
    let cardWarnings = cardWarningsByKeyValue[keyValue]
    if (cardWarnings === undefined) cardWarningsByKeyValue[keyValue] = cardWarnings = {}
    if (cardWarnings[name] === undefined) cardWarnings[name] = warning
  }

  return typedValue
}

export const listCards = wrapAsyncMiddleware(async function listCards(req, res) {
  // Respond a list of statements.
  let authenticatedUser = req.authenticatedUser
  let language = req.query.language
  let limit = req.query.limit || 20
  let offset = req.query.offset || 0
  let show = req.query.show || []
  let subTypes = req.query.type || []
  let subTypeIds = subTypes.map(getIdFromIdOrSymbol).filter(subTypeId => subTypeId)
  let tags = req.query.tag || []
  let tagIds = tags.map(getIdFromIdOrSymbol).filter(tag => tag)
  let term = req.query.term
  let trashed = show.includes("trashed")
  let userName = req.query.user // email or urlName

  let user = null
  if (userName) {
    if (!authenticatedUser) {
      res.status(401) // Unauthorized
      res.json({
        apiVersion: "1",
        code: 401, // Unauthorized
        message: "The statements of a user can only be retrieved by the user himself or an admin.",
      })
      return
    }

    if (userName.indexOf("@") >= 0) {
      user = entryToUser(
        await db.oneOrNone(
          `SELECT * FROM objects
          INNER JOIN users ON objects.id = users.id
          WHERE email = $1
        `,
          userName,
        ),
      )
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
      user = entryToUser(
        await db.oneOrNone(
          `SELECT * FROM objects
          INNER JOIN users ON objects.id = users.id
          WHERE url_name = $1
        `,
          userName,
        ),
      )
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
      res.status(403) // Forbidden
      res.json({
        apiVersion: "1",
        code: 403, // Forbidden
        message: "The statements of a user can only be retrieved by the user himself or an admin.",
      })
      return
    }
  }

  let whereClauses = []

  if (subTypeIds.length > 0) {
    whereClauses.push("sub_types && $<subTypeIds>")
  }

  if (tagIds.length > 0) {
    whereClauses.push("tags @> $<tagIds>")
  }

  if (term) {
    term = term.trim()
    if (term) {
      let languages = language ? [language] : config.languages
      let termClauses = languages.map(
        language =>
          `objects.id IN (
            SELECT cards_text_search.id
            FROM cards_text_search
            INNER JOIN languages_sets ON cards_text_search.languages_set_id = languages_sets.id
            WHERE text_search @@ plainto_tsquery('${languageConfigurationNameByCode[language]}', $<term>)
            AND '${language}' = ANY(languages_sets.languages)
          )`,
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

  if (!trashed) {
    whereClauses.push("NOT statements.trashed")
  }

  let whereClause = whereClauses.length === 0 ? "" : "WHERE " + whereClauses.join(" AND ")

  let coreArguments = {
    subTypeIds,
    tagIds,
    term,
    userId: user === null ? null : user.id,
  }
  let count = Number(
    (await db.one(
      `
      SELECT count(*) as count
      FROM objects
      INNER JOIN statements on objects.id = statements.id
      INNER JOIN cards on statements.id = cards.id
      ${whereClause}
    `,
      coreArguments,
    )).count,
  )

  let cards = (await db.any(
    `
      SELECT objects.*, statements.*, cards.*, symbol
      FROM objects
      INNER JOIN statements on objects.id = statements.id
      INNER JOIN cards on statements.id = cards.id
      LEFT JOIN symbols ON objects.id = symbols.id
      ${whereClause}
      ORDER BY rating_sum DESC, created_at DESC
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
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
    limit: limit,
    offset: offset,
  })
})

export const listTagsPopularity = wrapAsyncMiddleware(async function listTagsPopularity(req, res) {
  let limit = req.query.limit || 20
  let offset = req.query.offset || 0
  let subTypes = req.query.type || []
  let subTypeIds = subTypes.map(getIdFromIdOrSymbol).filter(subTypeId => subTypeId)
  let tags = req.query.tag || []
  let tagIds = tags.map(getIdFromIdOrSymbol).filter(tagId => tagId)

  let whereClauses = ["type = 'Card'"]

  if (subTypeIds.length > 0) {
    whereClauses.push("sub_types && $<subTypeIds>")
  }

  if (tagIds.length > 0) {
    whereClauses.push("tags @> $<tagIds>")
  }

  let whereClause = whereClauses.length === 0 ? "" : "WHERE " + whereClauses.join(" AND ")

  let coreArguments = {
    // language,
    subTypeIds,
    tagIds,
  }
  let count = Number(
    (await db.one(
      `
      SELECT count(*)
      FROM (
        SELECT DISTINCT unnest(tags) AS tag
        FROM objects
        ${whereClause}
      ) AS distinct_tags
    `,
      coreArguments,
    )).count,
  )

  let popularity = (await db.any(
    `
      SELECT unnest(tags) AS tag, count(id) AS count
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
  ))
    .filter(entry => !tagIds.includes(entry.tag))
    .map(entry => ({
      count: Number(entry.count),
      tagId: entry.tag,
    }))

  let valueByIdOrSymbol = {}
  for (let { tagId } of popularity) {
    valueByIdOrSymbol[getIdOrSymbolFromId(tagId)] = await toObjectJson(await getObjectFromId(tagId))
  }
  // Add requested tags, in order for client to have their informations.
  for (let tagId of tagIds) {
    valueByIdOrSymbol[getIdOrSymbolFromId(tagId)] = await toObjectJson(await getObjectFromId(tagId))
  }

  res.json({
    apiVersion: "1",
    count: count,
    data: {
      popularity: popularity.map(entry => ({
        count: entry.count,
        tagId: getIdOrSymbolFromId(entry.tagId),
      })),
      values: valueByIdOrSymbol,
    },
    limit: limit,
    offset: offset,
  })
})

export const listTagsPopularityOgp = wrapAsyncMiddleware(async function listTagsPopularityOgp(req, res) {
  let limit = req.query.limit || 20
  let offset = req.query.offset || 0
  let subTypes = req.query.type || []
  let subTypeIds = subTypes.map(getIdFromIdOrSymbol).filter(subTypeId => subTypeId)
  let tags = req.query.tag || []
  let tagIds = tags.map(getIdFromIdOrSymbol).filter(tagId => tagId)

  const ogpRootSymbols = {
    "public-integrity-measures": [
      "anti-corruption",
      "conflicts-of-interest",
      "asset-disclosure",
      "audits-control",
      "whistleblower-protections",
    ],
    "fiscal-openness": ["budget-transparency", "citizen-budgets", "participatory-budgeting"],
    "citizen-engagement": ["e-petitions", "social-audits", "public-participation"],
    procurement: ["public-procurement"],
    "access-to-information-mechanisms": ["records-management", "elections-political-finance"],
    justice: ["law-enforcement-justice"],
    "public-services": [
      "public-service-delivery-improvement",
      "e-government",
      "open-data",
      "capacity-building",
      "legislative-regulation",
    ],
    sectors: [
      "media-telecommunications",
      "education",
      "health-nutrition",
      "citizenship-immigration",
      "welfare-social-security",
      "water-sanitation",
      "infrastructure",
      "public-safety",
      "defense",
      "natural-resources",
      "aid",
      "nonprofits",
    ],
    "who-is-affected": ["private-sector", "legislature", "sub-national-governance", "judiciary"],
    "mainstreaming-issues": ["gender-sexuality", "human-rights", "ogp", "marginalised-communities", "labor"],
  }

  let whereClauses = ["type = 'Card'"]

  if (subTypeIds.length > 0) {
    whereClauses.push("sub_types && $<subTypeIds>")
  }

  let allowedTagIds = null
  let coreArguments
  let count
  let popularity
  let whereClause
  if (tagIds.length === 0) {
    allowedTagIds = Object.keys(ogpRootSymbols).map(getIdFromSymbol)
  } else if (tagIds.length === 1) {
    let tagSymbol = getIdOrSymbolFromId(tagIds[0])
    let subTagsSymbols = ogpRootSymbols[tagSymbol]
    if (subTagsSymbols !== undefined) {
      allowedTagIds = subTagsSymbols.map(getIdFromSymbol)
    }
  }
  if (allowedTagIds === null) {
    coreArguments = {
      // language,
      subTypeIds,
      tagIds,
    }
    whereClauses.push("tags @> $<tagIds>")
    whereClause = "WHERE " + whereClauses.join(" AND ")
    count = Number(
      (await db.one(
        `
        SELECT count(*)
        FROM (
          SELECT DISTINCT unnest(tags) AS tag
          FROM objects
          ${whereClause}
        ) AS distinct_tags
      `,
        coreArguments,
      )).count,
    )
    popularity = await db.any(
      `
        SELECT unnest(tags) AS tag, count(id) AS count
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
    )
  } else {
    coreArguments = {
      allowedTagIds,
      // language,
      subTypeIds,
    }
    whereClauses.push("tags && $<allowedTagIds>")
    whereClause = "WHERE " + whereClauses.join(" AND ")
    count = Number(
      (await db.one(
        `
        SELECT count(*)
        FROM (
          SELECT DISTINCT unnest(tags) AS tag
          FROM objects
          ${whereClause}
        ) AS distinct_tags
        WHERE distinct_tags.tag in ($<allowedTagIds:csv>)
      `,
        coreArguments,
      )).count,
    )
    popularity = await db.any(
      `
        SELECT *
        FROM (
          SELECT unnest(tags) AS tag, count(id) AS count
          FROM objects
          ${whereClause}
          GROUP BY tag
        ) AS popularity
        WHERE popularity.tag in ($<allowedTagIds:csv>)
        ORDER BY count DESC
        LIMIT $<limit>
        OFFSET $<offset>
      `,
      Object.assign({}, coreArguments, {
        limit,
        offset,
      }),
    )
  }

  popularity = popularity.filter(entry => !tagIds.includes(entry.tag)).map(entry => ({
    count: Number(entry.count),
    tagId: entry.tag,
  }))

  let valueByIdOrSymbol = {}
  for (let { tagId } of popularity) {
    valueByIdOrSymbol[getIdOrSymbolFromId(tagId)] = await toObjectJson(await getObjectFromId(tagId))
  }
  // Add requested tags, in order for client to have their informations.
  for (let tagId of tagIds) {
    valueByIdOrSymbol[getIdOrSymbolFromId(tagId)] = await toObjectJson(await getObjectFromId(tagId))
  }

  res.json({
    apiVersion: "1",
    count: count,
    data: {
      popularity: popularity.map(entry => ({
        count: entry.count,
        tagId: getIdOrSymbolFromId(entry.tagId),
      })),
      values: valueByIdOrSymbol,
    },
    limit: limit,
    offset: offset,
  })
})
