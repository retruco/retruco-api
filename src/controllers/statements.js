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

import {r} from "../database"
import {ownsUser, rateStatement, toStatementData, toStatementsData, unrateStatement,
  wrapAsyncMiddleware} from "../model"


export const bundleCards = wrapAsyncMiddleware(async function bundleCards(req, res, next) {
  let authenticatedUser = req.authenticatedUser
  let bundle = req.body
  let keyName = bundle.key

  // Retrieve all cards rated by user.
  let ballots = await r
    .table("ballots")
    .getAll(user.id, {index: "voterId"})
  let existingUserCards = await r
    .table("statements")
    .getAll("Card", {index: "type"})
    .innerJoin(ballots, function (statement, ballot) {
      return statement("id").eq(ballot("statementId"))
    })
    .getField("left")
  let existingUserCardById = {}
  let remainingUserStatementsIds = new Set()
  for (let card of existingUserCards) {
    existingUserCardById[card.id] = card
    remainingUserStatementsIds.add(card.id)
  }

  // Retrieve all properties of thes cards rated by user.
  let existingProperties = await r
    .table("statements")
    .getAll(...Object.keys(existingUserCardById).map(cardId => [cardId, "Property"]), {index: "statementIdAndType"})
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
  let existingUserProperties = await r
    .table("statements")
    .getAll(...Object.keys(existingUserCardById).map(cardId => [cardId, "Property"]), {index: "statementIdAndType"})
    .innerJoin(ballots, function (statement, ballot) {
      return statement("id").eq(ballot("statementId"))
    })
    .getField("left")
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
  let schema_and_widget_couple_by_name = {} 
  for (let attributes of bundle.cards) {
    for (let [name, value] of Object.entries(attributes)) {
      let [schema, widget] = schema_and_widget_couple_by_name[name] || [{}, {}]
      let valueType = typeof value
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
      schema_and_widget_couple_by_name[name] = [schema, widget]
    }
  }

  // Upsert and rate cards, and their properties
  for (let attributes of bundle.cards) {
    let keyValue = attributes[keyName]
    let keyProperty = existingUserPropertyByKeyValue[keyValue]
    let cardId = keyProperty ?  keyProperty.statementId : null
    card = cardId ? existingUserCardById[cardId] : null
    if (!card) {

    }
    let card = existingUserCardById[cardId]
    if (card) {
      remainingUserStatementsIds.delete(card.id)
    } else {
      card = {
        createdAt: r.now(),
        type: "Card",
      }
      let result = await r
        .table("statements")
        .insert(card, {returnChanges: true})
      card = result.changes[0].new_val
    }
    rateStatement(card.id, authenticatedUser.id, 1)
    let existingPropertiesByName = existingPropertiesByNameByCardId[card.id] || {}
    let existingUserPropertyByName = existingUserPropertyByNameByCardId[card.id] || {}
    for (let [name, value] of Object.entries(attributes)) {
      let [schema, widget] = schema_and_widget_couple_by_name[name]
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
        property = {
          createdAt: r.now(),
          schema: schema,
          statementId: card.id,
          type: "Property",
          value: value,
          widget: widget,
        }
        let result = await r
          .table("statements")
          .insert(property, {returnChanges: true})
        property = result.changes[0].new_val
      }
      rateStatement(property.id, authenticatedUser.id, 1)
    }
  }

  // Remove obsolete user ratings.
  for (let statementId of remainingUserStatementsIds) unrateStatement(statementId, authenticatedUser.id)

  res.json({
    apiVersion: "1",
  })
})


export const createStatement = wrapAsyncMiddleware(async function createStatement(req, res, next) {
  // Create a new statement.
  let show = req.query.show || []
  let statement = req.body

  if (["Argument", "Card", "PlainStatement", "Property"].includes(statement.type)) {
    delete statement.abuseId
    delete statement.isAbuse
  }
  if (statement.type === "PlainStatement") {
    statement.authorId = req.authenticatedUser.id  
  }
  statement.createdAt = r.now()
  delete statement.id
  delete statement.rating
  delete statement.ratingCount
  delete statement.ratingSum

  let result = await r
    .table("statements")
    .insert(statement, {returnChanges: true})
  statement = result.changes[0].new_val
  res.status(201)  // Created
  res.json({
    apiVersion: "1",
    data: await toStatementData(statement,  req.authenticatedUser, {
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
  await r
    .table("statements")
    .get(statement.id)
    .delete()
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
      let users = await r
        .table("users")
        .getAll(userName, {index: "email"})
        .limit(1)
      if (users.length < 1) {
        res.status(404)
        res.json({
          apiVersion: "1",
          code: 404,
          message: `No user with email "${userName}".`,
        })
        return
      }
      user = users[0]
    } else {
      let users = await r
        .table("users")
        .getAll(userName, {index: "urlName"})
        .limit(1)
      if (users.length < 1) {
        res.status(404)
        res.json({
          apiVersion: "1",
          code: 404,
          message: `No user named "${userName}".`,
        })
        return
      }
      user = users[0]
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

  let index = null
  let statements = r.table("statements")
  if (tagsName.length > 0) {
    statements = statements
      .getAll(...tagsName, {index: "tags"})
      .distinct()
    index = "tags"
  }
  if (type) {
    if (index === null) {
      statements = statements
        .getAll(type, {index: "type"})
      index = "type"
    } else {
      statements = statements
        .filter({type})
    }
  }
  if (languageCode) {
    if (index === null) {
      statements = statements
        .getAll(languageCode, {index: "languageCode"})
      index = "languageCode"
    } else {
      statements = statements
        .filter({languageCode})
    }
  }
  if (index === null) {
    statements = statements
      .orderBy({index: r.desc("createdAt")})
    index = "createdAt"
  } else {
    statements = statements
      .orderBy(r.desc("createdAt"))
  }
  if (user !== null) {
    let ballots = r.table("ballots")
      .getAll(user.id, {index: "voterId"})
    statements = statements
      .innerJoin(ballots, function (statement, ballot) {
        return statement("id").eq(ballot("statementId"))
      })
      .getField("left")
  }
  statements = await statements

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
  let statement = await r
    .table("statements")
    .get(id)
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
