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


import deepEqual from "deep-equal"

import {db, entryToBallot, entryToStatement} from "../database"
import {hashStatement, ownsUser, propagateOptimisticOptimization, rateStatement, toStatementData, toStatementsData,
  unrateStatement, wrapAsyncMiddleware} from "../model"


export const bundleCards = wrapAsyncMiddleware(async function bundleCards(req, res, next) {
  let authenticatedUser = req.authenticatedUser
  let bundle = req.body
  let keyName = bundle.key

  // Retrieve all cards rated by user.
  let existingUserCards = (await db.any(`
    SELECT * FROM statements
    WHERE type = 'Card'
    AND id IN (SELECT statement_id FROM ballots WHERE voter_id = $1)
    `, [authenticatedUser.id])).map(entryToStatement)
  let existingUserCardById = {}
  let remainingUserStatementsIds = new Set()
  for (let card of existingUserCards) {
    existingUserCardById[card.id] = card
    remainingUserStatementsIds.add(card.id)
  }

  // Retrieve all properties of thes cards rated by user.
  let existingProperties = (await db.any(`
    SELECT * FROM statements
    WHERE type = 'Property'
    AND (data->>'statementId')::bigint IN (
      SELECT id FROM statements
      WHERE type = 'Card'
      AND id IN (SELECT statement_id FROM ballots WHERE voter_id = $1)
    )
    `, [authenticatedUser.id])).map(entryToStatement)
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
    `, [authenticatedUser.id])).map(entryToStatement)
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

  // Guess schema and widget of each attribute.
  let fieldByName = {} 
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
            if (widget.tag !== "input" || widget.type !== "text") widget = {tag: "input", type: "text"}
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

  // Upsert and rate cards, and their properties
  for (let attributes of bundle.cards) {
    let keyValue = attributes[keyName]
    let keyProperty = existingUserPropertyByKeyValue[keyValue]
    let cardId = keyProperty ?  keyProperty.statementId : null
    let card = cardId ? existingUserCardById[cardId] : null
    if (card) {
      remainingUserStatementsIds.delete(card.id)
    } else {
      console.log(`Creating card ${cardId} for ${keyValue}`)
      card = {}
      const cardType = 'Card'
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
    }
    rateStatement(card.id, authenticatedUser.id, 1)  // await not needed
    let existingPropertiesByName = existingPropertiesByNameByCardId[card.id] || {}
    for (let [name, value] of Object.entries(attributes)) {
      let {maxLength, schema, widget} = fieldByName[name]
      if (maxLength > 1) {
        if (!Array.isArray(value)) value = [value]
      } else {
        if (Array.isArray(value)) value = value.length > 0 ? value[0] : null
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
          statementId: card.id,
          value,
          widget,
        }
        const propertyType = 'Property'
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
      }
      rateStatement(property.id, authenticatedUser.id, 1)  // await not needed
    }
  }

  // Remove obsolete user ratings.
  console.log("remainingUserStatementsIds:", remainingUserStatementsIds.size)
  for (let statementId of remainingUserStatementsIds) {
    unrateStatement(statementId, authenticatedUser.id)  // await not needed
  }

  res.json({
    apiVersion: "1",
  })
})


export const createStatement = wrapAsyncMiddleware(async function createStatement(req, res, next) {
  // Create a new statement.
  let show = req.query.show || []
  let statement = req.body
  let statementType = statement.type

  if (["Argument", "Card", "PlainStatement", "Property"].includes(statementType)) {
    delete statement.abuseId
    delete statement.isAbuse
  }
  if (["PlainStatement", "Tag"].includes(statementType)) {
    statement.name = statement.name.replace(/[\n\r]+/g," ").replace(/\s+/g," ").trim()
    if (statement.name.length === 0) {
      res.status(400)
      res.json({
        apiVersion: "1",
        code: 400,  // Bad Request
        message: `Missing or empty name in statement.`,
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
  let existingStatement = entryToStatement(await db.oneOrNone(`SELECT * FROM statements WHERE hash = $1`, hash))
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


export const deleteStatement = wrapAsyncMiddleware(async function deleteStatement(req, res, next) {
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
  await db.none(`DELETE FROM statements WHERE id = $<id>`, statement)
  res.json({
    apiVersion: "1",
    data: data,
  })
})


export const getStatement = wrapAsyncMiddleware(async function getStatement(req, res, next) {
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


export const listStatements = wrapAsyncMiddleware(async function listStatements(req, res, next) {
  // Respond a list of statements.
  let authenticatedUser = req.authenticatedUser
  let languageCode = req.query.languageCode
  let show = req.query.show || []
  let tagsName = req.query.tag || []
  let type = req.query.type
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
      user = entryToUser(await db.oneOrNone(`SELECT * FROM users WHERE email = $1`, [userName]))
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
      user = entryToUser(await db.oneOrNone(`SELECT * FROM users WHERE url_name = $1`, [userName]))
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
    whereClauses.push(`data->'languageCode' = $<languageCode>`)
  }
  if (tagsName.length > 0) {
    whereClauses.push(`data->'tags' @> $<tagsName>`)
  }
  if (type) {
    whereClauses.push(`type = $<type>`)
  }
  if (user !== null) {
    whereClauses.push(`id in (SELECT statement_id FROM ballots WHERE voter_id = $<userId>)`)
  }
  let whereClause = whereClauses.length === 0 ? '' : 'WHERE ' + whereClauses.join(' AND ')

  let statements = (await db.any(
    `SELECT * FROM statements ${whereClause} ORDER BY created_at DESC`,
    {
      languageCode,
      tagsName,
      type,
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
  let statement = entryToStatement(await db.oneOrNone(`SELECT * FROM statements WHERE id = $1`, id))
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
