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
import {toStatementData, toStatementsData} from "../model"


export {createStatement}
async function createStatement(ctx) {
  // Create a new statement.
  let show = ctx.parameter.show || []
  let statement = ctx.parameter.statement

  if (statement.type === "Argument") {
    delete statement.isAbuse
  } else if (statement.type === "PlainStatement") {
    statement.authorId = ctx.authenticatedUser.id  
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
  ctx.status = 201  // Created
  ctx.body = {
    apiVersion: "1",
    data: await toStatementData(statement, {
      depth: ctx.parameter.depth || 0,
      showAuthor: show.includes("author"),
      showGrounds: show.includes("grounds"),
      showTags: show.includes("tags"),
    }),
  }
}


export {deleteStatement}
async function deleteStatement(ctx) {
  // Delete an existing statement.
  let show = ctx.parameter.show || []
  let statement = ctx.statement

  // TODO: Instead of deleting statement, add a vote to flag it (using a given reason)?

  const data = await toStatementData(statement, {
    depth: ctx.parameter.depth || 0,
    showAuthor: show.includes("author"),
    showGrounds: show.includes("grounds"),
    showTags: show.includes("tags"),
  })
  // TODO: If delete is kept, also remove all other linked statements (grounds, tags, abuse, etc).
  await r
    .table("statements")
    .get(statement.id)
    .delete()
  ctx.body = {
    apiVersion: "1",
    data: data,
  }
}


export {getStatement}
async function getStatement(ctx) {
  // Respond an existing statement.

  let show = ctx.parameter.show || []
  ctx.body = {
    apiVersion: "1",
    data: await toStatementData(ctx.statement, {
      depth: ctx.parameter.depth || 0,
      showAuthor: show.includes("author"),
      showGrounds: show.includes("grounds"),
      showTags: show.includes("tags"),
    }),
  }
}


export {listStatements}
async function listStatements(ctx) {
  // Respond a list of statements.
  let languageCode = ctx.parameter.languageCode
  let show = ctx.parameter.show || []
  let tagsName = ctx.parameter.tag || []

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

  ctx.body = {
    apiVersion: "1",
    data: await toStatementsData(statements, {
      depth: ctx.parameter.depth || 0,
      showAuthor: show.includes("author"),
      showGrounds: show.includes("grounds"),
      showTags: show.includes("tags"),
    }),
  }
}


export {requireStatement}
async function requireStatement(ctx, next) {
  let id = ctx.parameter.statementId
  let statement = await r
    .table("statements")
    .get(id)
  if (statement === null) {
    ctx.status = 404
    ctx.body = {
      apiVersion: "1",
      code: 404,
      message: `No statement with ID "${id}".`,
    }
    return
  }
  ctx.statement = statement

  await next()
}
