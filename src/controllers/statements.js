// Retruco-API -- HTTP API to bring out shared positions from argumented statements
// By: Paula Forteza <paula@gouv2.fr>
//     Emmanuel Raviart <emmanuel@gouv2.fr>
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


export {createStatement}
async function createStatement(ctx) {
  // Create a new statement.
  let statement = ctx.parameter.statement

  if (statement.type === "PlainStatement") {
    delete statement.isAbuse
    statement.authorId = ctx.authenticatedUser.id  
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
    data: await toStatementJson(statement, {showAuthorName: true}),
  }
}


export {deleteStatement}
async function deleteStatement(ctx) {
  // Delete an existing statement.
  let statement = ctx.statement

  // TODO: Instead of deleting statement, add a vote to flag it (using a given reason).

  // Delete statement.
  await r
    .table("statements")
    .get(statement.id)
    .delete()
  ctx.body = {
    apiVersion: "1",
    data: await toStatementJson(statement, {showAuthorName: true}),
  }
}


export {getStatement}
async function getStatement(ctx) {
  // Respond an existing statement.

  ctx.body = {
    apiVersion: "1",
    data: await toStatementJson(ctx.statement, {showAuthorName: true}),
  }
}


export {listStatements}
async function listStatements(ctx) {
  // Respond a list of statements.
  let languageCode = ctx.parameter.languageCode
  let statements
  if (languageCode) {
    statements = await r
      .table("statements")
      .getAll(languageCode, {index: "languageCode"})
  } else {
    statements = await r
      .table("statements")
      .orderBy({index: r.desc("createdAt")})
  }
  ctx.body = {
    apiVersion: "1",
    data: await Promise.all(statements.map(toStatementJson)),
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


async function toStatementJson(statement, {showAuthorName = false} = {}) {
  let statementJson = {...statement}
  if (statement.type === "PlainStatement") {
    if (showAuthorName && statement.authorId) {
      statementJson.authorName = await r
        .table("users")
        .get(statement.authorId)
        .getField("urlName")
    }
    delete statementJson.authorId
  }
  statementJson.createdAt = statementJson.createdAt.toISOString()
  return statementJson
}
