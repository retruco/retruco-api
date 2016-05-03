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


async function addRatingEvent(statementId) {
  let events = await r
    .table("events")
    .getAll([statementId, "statement rating"], {index: "statementIdAndType"})
    .limit(1)
  if (events.length < 1) {
    await r
      .table("events")
      .insert({
        createdAt: r.now(),
        statementId,
        type: "statement rating",
      })
  }
}


export {create}
async function create(ctx) {
  // Create a new statement.
  let statement = ctx.parameter.statement

  statement.authorId = ctx.authenticatedUser.id
  statement.createdAt = r.now()
  delete statement.id

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
    data: await toStatementJson(statement, {showAuthorName: true}),
  }
}


export {deleteRating}
async function deleteRating(ctx) {
  // Delete a statement rating.
  let statement = ctx.statement

  let id = [statement.id, ctx.authenticatedUser.id].join("/")
  let statementRating = await r
    .table("statementsRating")
    .get(id)
  if (statementRating === null) {
    statementRating = {
      id,
      // rating: null,
      statementId: statement.id,
      // updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
  } else {
    await r
      .table("statementsRating")
      .get(id)
      .delete()
    await addRatingEvent(statement.id)
  }

  ctx.body = {
    apiVersion: "1",
    data: await toStatementRatingJson(statementRating, {showVoterName: true}),
  }
}


export {get}
async function get(ctx) {
  // Respond an existing statement.

  ctx.body = {
    apiVersion: "1",
    data: await toStatementJson(ctx.statement, {showAuthorName: true}),
  }
}


export {getRating}
async function getRating(ctx) {
  // Respond an existing statement rating.
  let statement = ctx.statement

  let id = [statement.id, ctx.authenticatedUser.id].join("/")
  let statementRating = await r
    .table("statementsRating")
    .get(id)
  if (statementRating === null) {
    statementRating = {
      id,
      // rating: null,
      statementId: statement.id,
      // updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
  }

  ctx.body = {
    apiVersion: "1",
    data: await toStatementRatingJson(statementRating, {showVoterName: true}),
  }
}


export {list}
async function list(ctx) {
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
  if (showAuthorName && statement.authorId) {
    statementJson.authorName = await r
      .table("users")
      .get(statement.authorId)
      .getField("urlName")
  }
  delete statementJson.authorId
  statementJson.createdAt = statementJson.createdAt.toISOString()
  return statementJson
}


async function toStatementRatingJson(statementRating, {showVoterName = false} = {}) {
  let statementRatingJson = {...statementRating}
  delete statementRatingJson.id
  if (showVoterName && statementRating.voterId) {
    statementRatingJson.voterName = await r
      .table("users")
      .get(statementRating.voterId)
      .getField("urlName")
  }
  delete statementRatingJson.voterId
  if (statementRatingJson.updatedAt) statementRatingJson.updatedAt = statementRatingJson.updatedAt.toISOString()
  return statementRatingJson
}


export {upsertRating}
async function upsertRating(ctx) {
  // Insert or update a statement rating.
  let statement = ctx.statement
  let ratingData = ctx.parameter.ratingData

  let id = [statement.id, ctx.authenticatedUser.id].join("/")
  let statementRating = await r
    .table("statementsRating")
    .get(id)
  if (statementRating === null) {
    statementRating = {
      id,
      rating: ratingData.rating,
      statementId: statement.id,
      updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
    let result = await r
      .table("statementsRating")
      .insert(statementRating, {returnChanges: true})
    statementRating = result.changes[0].new_val
    await addRatingEvent(statement.id)
    ctx.status = 201  // Created
  } else if (ratingData.rating !== statementRating.rating) {
    statementRating.rating = ratingData.rating
    statementRating.updatedAt = r.now()
    let result = await r
      .table("statementsRating")
      .get(id)
      .update(statementRating, {returnChanges: true})
    statementRating = result.changes[0].new_val
    await addRatingEvent(statement.id)
  }
  ctx.body = {
    apiVersion: "1",
    data: await toStatementRatingJson(statementRating, {showVoterName: true}),
  }
}
