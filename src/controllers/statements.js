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


import {r} from "../database"
import {toStatementData, toStatementsData, wrapAsyncMiddleware} from "../model"


export const createStatement = wrapAsyncMiddleware(async function createStatement(req, res, next) {
  // Create a new statement.
  let show = req.query.show || []
  let statement = req.body

  if (statement.type === "Argument") {
    delete statement.isAbuse
  } else if (statement.type === "PlainStatement") {
    statement.authorId = req.authenticatedUser.id  
    delete statement.isAbuse
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
      showTags: show.includes("tags"),
    }),
  })
})


export const listStatements = wrapAsyncMiddleware(async function listStatements(req, res, next) {
  // Respond a list of statements.
  let languageCode = req.query.languageCode
  let show = req.query.show || []
  let tagsName = req.query.tag || []

  let index = null
  let statements = r.table("statements")
  if (tagsName.length > 0) {
    statements = statements
      .getAll(...tagsName, {index: "tags"})
      .distinct()
    index = "tags"
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
  statements = await statements

  res.json({
    apiVersion: "1",
    data: await toStatementsData(statements, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showAbuse: show.includes("abuse"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
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
