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
import deepEqual from "deep-equal"
import {randomBytes} from "mz/crypto"

import config from "../config"
import {db, entryToStatement, entryToUser, generateStatementTextSearch, hashStatement,
  languageConfigurationNameByCode} from "../database"
import {ownsUser, propagateOptimisticOptimization, rateStatement, toStatementData, toStatementsData, toStatementJson,
  types, unrateStatement, wrapAsyncMiddleware} from "../model"


export const autocompleteStatements = wrapAsyncMiddleware(async function autocompleteStatements(req, res) {
  // Respond a list of statements.
  let languageCode = req.query.languageCode
  let limit = req.query.limit || 10
  let queryTypes = req.query.type || []
  let term = req.query.term

  let whereClauses = []

  if (languageCode) {
    whereClauses.push("data->>'languageCode' = $<languageCode> OR data->'languageCode' IS NULL")
  }

  let cardTypes = []
  let statementTypes = []
  for (let type of queryTypes) {
    if (types.includes(type)) statementTypes.push(type)
    else cardTypes.push(type)
  }
  if (cardTypes.length > 0) {
    whereClauses.push("data->'values'->'Card Type' ?| array[$<cardTypes:csv>]")
  }
  if (statementTypes.length > 0) {
    whereClauses.push("type IN ($<statementTypes:csv>)")
  }

  let whereClause = whereClauses.length === 0 ? "" : "WHERE " + whereClauses.join(" AND ")

  let statementsEntries = await db.any(
    `SELECT statements.*, statements_autocomplete.autocomplete,
        statements_autocomplete.autocomplete <-> $<term> AS distance
      FROM statements
      LEFT JOIN statements_autocomplete ON statements.id = statements_autocomplete.statement_id
      ${whereClause}
      ORDER BY distance
      LIMIT $<limit>`,
    {
      cardTypes,
      languageCode,
      limit,
      statementTypes,
      term: term || "",
    }
  )

  res.json({
    apiVersion: "1",
    data: statementsEntries.map(function (statementEntry) {
      let autocomplete = statementEntry.autocomplete
      delete statementEntry.autocomplete
      let distance = statementEntry.distance
      delete statementEntry.distance
      return {
        autocomplete,
        distance,
        statement: toStatementJson(entryToStatement(statementEntry)),
      }
    }),
  })
})


export const bundleCards = wrapAsyncMiddleware(async function bundleCards(req, res) {
  let ajvStrict = new Ajv({
    // See: https://github.com/epoberezkin/ajv#options
    allErrors: true,
    format: "full",
    formats: {
      uriref: () => true,  // Accept every string.
    },
    unknownFormats: true,
    verbose: true,
  })
  let authenticatedUser = req.authenticatedUser
  let bundle = req.body
  let keyName = bundle.key

  // Validate given schemas (if any).
  let schemaErrorsByName = {}
  for (let [name, schema] of Object.entries(bundle.schemas || {})) {
    try {
      ajvStrict.compile(schema)
    } catch (e) {
      schemaErrorsByName[name] = e.message
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
          if (schema.type !== "string") schema = {type: "string"}
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
  for (let field of Object.values(fieldByName)) {
    if (field.maxLength > 1) {
      field.schema = {
        items: field.schema,
        type: "array",
      }
      field.widget = {
        items: field.widget,
        tag: "array",
      }
    }
  }

  let ajvWithCoercion = new Ajv({
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
  let schemaValidator = ajvWithCoercion.compile({
    type: "object",
    properties: Object.entries(fieldByName).reduce((schemaByName, [name, {schema}]) => {
      schemaByName[name] = schema
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

  // Retrieve all cards rated by user.
  let existingUserCards = (await db.any(`
    SELECT * FROM statements
    WHERE type = 'Card'
    AND id IN (SELECT statement_id FROM ballots WHERE voter_id = $1)
    `, authenticatedUser.id)).map(entryToStatement)
  let existingUserCardById = {}
  let remainingUserStatementsIds = new Set()
  for (let card of existingUserCards) {
    existingUserCardById[card.id] = card
    remainingUserStatementsIds.add(card.id)
  }

  // Retrieve all properties of the cards rated by user.
  let existingProperties = (await db.any(`
    SELECT * FROM statements
    WHERE type = 'Property'
    AND (data->>'statementId')::bigint IN (
      SELECT id FROM statements
      WHERE type = 'Card'
      AND id IN (SELECT statement_id FROM ballots WHERE voter_id = $1)
    )
    `, authenticatedUser.id)).map(entryToStatement)
  let existingPropertiesByNameByCardId = {}
  for (let property of existingProperties) {
    let existingPropertiesByName = existingPropertiesByNameByCardId[property.statementId]
    if (!existingPropertiesByName) {
      existingPropertiesByNameByCardId[property.statementId] = existingPropertiesByName = {}
    }
    let sameNameExistingProperties = existingPropertiesByName[property.name]
    if (!sameNameExistingProperties) existingPropertiesByName[property.name] = sameNameExistingProperties = []
    sameNameExistingProperties.push(property)
  }
  let existingUserProperties = (await db.any(`
    SELECT * FROM statements
    WHERE type = 'Property'
    AND id IN (SELECT statement_id FROM ballots WHERE voter_id = $1)
    AND (data->>'statementId')::bigint IN (
      SELECT id FROM statements
      WHERE type = 'Card'
      AND id IN (SELECT statement_id FROM ballots WHERE voter_id = $1)
    )
    `, authenticatedUser.id)).map(entryToStatement)
  let existingUserPropertyByKeyValue = {}
  let existingUserPropertyByNameByCardId = {}
  for (let property of existingUserProperties) {
    let existingUserPropertyByName = existingUserPropertyByNameByCardId[property.statementId]
    if (!existingUserPropertyByName) {
      existingUserPropertyByNameByCardId[property.statementId] = existingUserPropertyByName = {}
    }
    existingUserPropertyByName[property.name] = property
    if (property.name == keyName) existingUserPropertyByKeyValue[property.value] = property
    remainingUserStatementsIds.add(property.id)
  }

  // Upsert and rate cards.
  let cardIdByKeyValue = {}
  for (let attributes of bundle.cards) {
    let keyValue = attributes[keyName]
    let keyProperty = existingUserPropertyByKeyValue[keyValue]
    let cardId = keyProperty ?  keyProperty.statementId : null
    let card = cardId ? existingUserCardById[cardId] : null
    if (card) {
      remainingUserStatementsIds.delete(card.id)
    } else {
      console.log(`Creating new card for ${keyValue}`)
      card = {
        // Ensure that each card has a unique hash.
        randomId: (await randomBytes(16)).toString("base64").replace(/=/g, ""),  // 128 bits
      }
      const cardType = "Card"
      let hash = hashStatement(cardType, card)
      let result = await db.one(
        `INSERT INTO statements(created_at, hash, type, data)
          VALUES (current_timestamp, $1, $2, $3)
          RETURNING created_at, id, rating, rating_count, rating_sum`,
        [hash, cardType, card],
      )
      Object.assign(card, {
        createdAt: result.created_at,
        id: result.id,
        rating: result.rating,
        ratingCount: result.rating_count,
        ratingSum: result.rating_sum,
        type: cardType,
      })
      await generateStatementTextSearch(card)
    }
    await rateStatement(card.id, authenticatedUser.id, 1)
    cardIdByKeyValue[keyValue] = card.id
  }

  // Upsert and rate properties of cards.
  let cardWarningsByKeyValue = {}
  for (let attributes of bundle.cards) {
    let keyValue = attributes[keyName]
    let cardId = cardIdByKeyValue[keyValue]
    let existingPropertiesByName = existingPropertiesByNameByCardId[cardId] || {}
    for (let [name, value] of Object.entries(attributes)) {
      let {maxLength, schema, widget} = fieldByName[name]

      if (maxLength > 1) {
        if (!Array.isArray(value)) value = [value]
      } else {
        if (Array.isArray(value)) value = value.length > 0 ? value[0] : null
      }

      if (schema.type === "string" && schema.format === "uriref") {
        let referencedCardId = cardIdByKeyValue[value]
        if (referencedCardId === undefined) {
          let cardWarnings = cardWarningsByKeyValue[keyValue]
          if (cardWarnings === undefined) cardWarningsByKeyValue[keyValue] = cardWarnings = {}
          cardWarnings[name] = `Unknown key ${value} for referenced card.`
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
            attributeWarnings[String(index)] = `Unknown key ${value} for card`
            cardWarnings[name] = {"0": `Unknown key ${item} for referenced card.`}
          } else {
            item = referencedCardId
          }
          items.push(item)
        }
        value = items
      }

      let property = null
      let sameNameExistingProperties = existingPropertiesByName[name] || []
      for (let existingProperty of sameNameExistingProperties)  {
        if (deepEqual(existingProperty.schema, schema) && deepEqual(existingProperty.widget, widget)
            && deepEqual(existingProperty.value, value)) {
          property = existingProperty
          break
        }
      }
      if (property !== null) {
        remainingUserStatementsIds.delete(property.id)
      } else {
        console.log(`Creating property ${name} = ${value} of card ${cardId} for ${keyValue}`)
        property = {
          name,
          schema,
          statementId: cardId,
          value,
          widget,
        }
        const propertyType = "Property"
        let hash = hashStatement(propertyType, property)
        let result = await db.one(
          `INSERT INTO statements(created_at, hash, type, data)
            VALUES (current_timestamp, $1, $2, $3)
            RETURNING created_at, id, rating, rating_count, rating_sum`,
          [hash, propertyType, property],
        )
        Object.assign(property, {
          createdAt: result.created_at,
          id: result.id,
          rating: result.rating,
          ratingCount: result.rating_count,
          ratingSum: result.rating_sum,
          type: propertyType,
        })
        await generateStatementTextSearch(property)
      }
      await rateStatement(property.id, authenticatedUser.id, 1)
    }
  }

  // Remove obsolete user ratings.
  console.log("remainingUserStatementsIds:", remainingUserStatementsIds.size)
  for (let statementId of remainingUserStatementsIds) {
    await unrateStatement(statementId, authenticatedUser.id)
  }

  let result = {
    apiVersion: "1",
  }
  let warningMessages = {}
  if (Object.keys(cardWarningsByKeyValue).length > 0) warningMessages["cards"] = cardWarningsByKeyValue
  if (Object.keys(warningMessages).length > 0) result.warnings = warningMessages
  res.json(result)
})


export const createStatement = wrapAsyncMiddleware(async function createStatement(req, res) {
  // Create a new statement.
  let show = req.query.show || []
  let statement = req.body
  let statementType = statement.type

  if (["Argument", "Card", "Citation", "Event", "Person", "PlainStatement", "Property"].includes(statementType)) {
    delete statement.abuseId
    delete statement.isAbuse
  }
  if (["Event", "Person", "PlainStatement", "Tag"].includes(statementType)) {
    statement.name = statement.name.replace(/[\n\r]+/g," ").replace(/\s+/g," ").trim()
    if (statement.name.length === 0) {
      res.status(400)
      res.json({
        apiVersion: "1",
        code: 400,  // Bad Request
        message: "Missing or empty name in statement.",
      })
      return
    }
  }
  if (statementType === "PlainStatement") {
    statement.authorId = req.authenticatedUser.id
  }
  delete statement.createdAt
  delete statement.deleted
  delete statement.id
  delete statement.rating
  delete statement.ratingCount
  delete statement.ratingSum
  delete statement.type

  let hash = hashStatement(statementType, statement)
  let existingStatement = entryToStatement(await db.oneOrNone("SELECT * FROM statements WHERE hash = $1", hash))
  if (existingStatement === null) {
    let result = await db.one(
      `INSERT INTO statements(created_at, hash, type, data)
        VALUES (current_timestamp, $1, $2, $3)
        RETURNING created_at, id, rating, rating_count, rating_sum`,
      [hash, statementType, statement],
    )
    Object.assign(statement, {
      createdAt: result.created_at,
      id: result.id,
      rating: result.rating,
      ratingCount: result.rating_count,
      ratingSum: result.rating_sum,
      type: statementType,
    })
    await generateStatementTextSearch(statement)
  } else {
    statement = existingStatement
  }
  let [oldBallot, ballot] = await rateStatement(statement.id, req.authenticatedUser.id, 1)

  // Optimistic optimizations
  const statements = []
  const oldRating = statement.rating
  const oldRatingSum = statement.ratingSum
  statements.push(statement)
  if (oldBallot === null) statement.ratingCount += 1
  statement.ratingSum += ballot.rating - (oldBallot === null ? 0 : oldBallot.rating)
  statement.ratingSum = Math.max(-statement.ratingCount, Math.min(statement.ratingCount, statement.ratingSum))
  statement.rating = statement.ratingSum / statement.ratingCount
  await propagateOptimisticOptimization(statements, statement, oldRating, oldRatingSum)

  if (existingStatement === null) res.status(201)  // Created
  res.json({
    apiVersion: "1",
    data: await toStatementData(statement, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showAbuse: show.includes("abuse"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
      showProperties: show.includes("properties"),
      showTags: show.includes("tags"),
      statements,
    }),
  })
})


export const deleteStatement = wrapAsyncMiddleware(async function deleteStatement(req, res) {
  // Delete an existing statement.
  let show = req.query.show || []
  let statement = req.statement

  // TODO: Instead of deleting statement, add a vote to flag it (using a given reason)?

  statement.deleted = true
  const data = await toStatementData(statement, req.authenticatedUser, {
    depth: req.query.depth || 0,
    showAbuse: show.includes("abuse"),
    showAuthor: show.includes("author"),
    showBallot: show.includes("ballot"),
    showGrounds: show.includes("grounds"),
    showProperties: show.includes("properties"),
    showTags: show.includes("tags"),
  })
  // TODO: If delete is kept, also remove all other linked statements (grounds, tags, abuse, etc).
  await db.none("DELETE FROM statements WHERE id = $<id>", statement)
  res.json({
    apiVersion: "1",
    data: data,
  })
})


export const getStatement = wrapAsyncMiddleware(async function getStatement(req, res) {
  // Respond an existing statement.

  let show = req.query.show || []
  res.json({
    apiVersion: "1",
    data: await toStatementData(req.statement,  req.authenticatedUser, {
      depth: req.query.depth || 0,
      showAbuse: show.includes("abuse"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
      showProperties: show.includes("properties"),
      showTags: show.includes("tags"),
    }),
  })
})


export const listStatements = wrapAsyncMiddleware(async function listStatements(req, res) {
  // Respond a list of statements.
  let authenticatedUser = req.authenticatedUser
  let languageCode = req.query.languageCode
  let limit = req.query.limit || 20
  let offset = req.query.offset || 0
  let queryTypes = req.query.type || []
  let show = req.query.show || []
  let tagsName = req.query.tag || []
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
      user = entryToUser(await db.oneOrNone("SELECT * FROM users WHERE email = $1", userName))
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
      user = entryToUser(await db.oneOrNone("SELECT * FROM users WHERE url_name = $1", userName))
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

  if (languageCode) {
    whereClauses.push("data->>'languageCode' = $<languageCode> OR data->'languageCode' IS NULL")
  }

  if (tagsName.length > 0) {
    whereClauses.push("data->'tags' @> $<tagsName>")
  }

  if (term) {
    term = term.trim()
    if (term) {
      let languageCodes = languageCode ? [languageCode] : config.languageCodes
      let termClauses = languageCodes.map( languageCode =>
        `id IN (
          SELECT statement_id
            FROM statements_text_search
            WHERE text_search @@ plainto_tsquery('${languageConfigurationNameByCode[languageCode]}', $<term>)
            AND configuration_name = '${languageConfigurationNameByCode[languageCode]}'
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

  let cardTypes = []
  let statementTypes = []
  for (let type of queryTypes) {
    if (types.includes(type)) statementTypes.push(type)
    else cardTypes.push(type)
  }
  if (cardTypes.length > 0) {
    whereClauses.push("data->'values'->'Card Type' ?| array[$<cardTypes:csv>]")
  }
  if (statementTypes.length > 0) {
    whereClauses.push("type IN ($<statementTypes:csv>)")
  }

  if (user !== null) {
    whereClauses.push("id IN (SELECT statement_id FROM ballots WHERE voter_id = $<userId>)")
  }

  let whereClause = whereClauses.length === 0 ? "" : "WHERE " + whereClauses.join(" AND ")
  let statements = (await db.any(
    `SELECT * FROM statements ${whereClause} ORDER BY created_at DESC LIMIT $<limit> OFFSET $<offset>`,
    {
      cardTypes,
      languageCode,
      limit,
      offset,
      statementTypes,
      tagsName,
      term,
      userId: user === null ? null : user.id,
    }
  )).map(entryToStatement)

  res.json({
    apiVersion: "1",
    data: await toStatementsData(statements, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showAbuse: show.includes("abuse"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
      showProperties: show.includes("properties"),
      showTags: show.includes("tags"),
    }),
  })
})


export const requireStatement = wrapAsyncMiddleware(async function requireStatement(req, res, next) {
  let id = req.params.statementId
  let statement = entryToStatement(await db.oneOrNone("SELECT * FROM statements WHERE id = $1", id))
  if (statement === null) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No statement with ID "${id}".`,
    })
    return
  }
  req.statement = statement

  return next()
})
