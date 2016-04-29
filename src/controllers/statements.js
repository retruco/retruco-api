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


export {create}
async function create(ctx) {
  // Create a new statement.
  let statement = ctx.parameter.statement

  statement.createdAt = r.now()
  delete statement.id

  let result = await r
    .table("statements")
    .insert(statement, {returnChanges: true})
  statement = result.changes[0].new_val
  ctx.status = 201  // Created
  ctx.body = {
    apiVersion: "1",
    data: toStatementJson(statement),
  }
}


export {del}
async function del(ctx) {
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
    data: toStatementJson(statement),
  }
}


export {get}
async function get(ctx) {
  // Respond an existing statement.

  ctx.body = {
    apiVersion: "1",
    data: toStatementJson(ctx.statement),
  }
}


export {list}
async function list(ctx) {
  // Respond a list of all statements.
  let statements = await r
    .table("statements")
    .orderBy({index: r.desc("createdAt")})
  ctx.body = {
    apiVersion: "1",
    data: statements.map(toStatementJson),
  }
}


export {listLanguage}
async function listLanguage(ctx) {
  // Respond a list of all statements.
  let languageCode = ctx.statementLanguageCode
  let statements = await r
    .table("statements")
    .getAll(languageCode, {index: "languageCode"})
  ctx.body = {
    apiVersion: "1",
    data: statements.map(toStatementJson),
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


function toStatementJson(statement) {
  let statementJson = {...statement}
  statementJson.createdAt = statementJson.createdAt.toISOString()
  return statementJson
}
