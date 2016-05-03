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


export {del}
async function del(ctx) {
  // Delete an existing statement rating.
  let statement = ctx.statement

  let statementsRating = await r
    .table("statementsRating")
    .getAll([statement.id, ctx.authenticatedUser.id], {index: "statementIdAndVoterId"})
    .limit(1)
  let statementRating
  if (statementsRating.length < 1) {
    statementRating = {
      // rating: null,
      statementId: statement.id,
      // updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
  } else {
    statementRating = statementsRating[0]
    await r
      .table("statementsRating")
      .get(statementRating.id)
      .delete()
  }

  ctx.body = {
    apiVersion: "1",
    data: await toStatementRatingJson(statementRating, {showVoterName: true}),
  }
}


export {get}
async function get(ctx) {
  // Respond an existing statement rating.
  let statement = ctx.statement

  let statementsRating = await r
    .table("statementsRating")
    .getAll([statement.id, ctx.authenticatedUser.id], {index: "statementIdAndVoterId"})
    .limit(1)
  let statementRating
  if (statementsRating.length < 1) {
    statementRating = {
      // rating: null,
      statementId: statement.id,
      // updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
  } else {
    statementRating = statementsRating[0]
  }

  ctx.body = {
    apiVersion: "1",
    data: await toStatementRatingJson(statementRating, {showVoterName: true}),
  }
}


export {upsert}
async function upsert(ctx) {
  // Insert or update a statement rating.
  let statement = ctx.statement
  let ratingData = ctx.parameter.ratingData

  let statementsRating = await r
    .table("statementsRating")
    .getAll([statement.id, ctx.authenticatedUser.id], {index: "statementIdAndVoterId"})
    .limit(1)
  let statementRating
  if (statementsRating.length < 1) {
    statementRating = {
      rating: ratingData.rating,
      statementId: statement.id,
      updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
    let result = await r
      .table("statementsRating")
      .insert(statementRating, {returnChanges: true})
    statementRating = result.changes[0].new_val
    ctx.status = 201  // Created
  } else {
    statementRating = statementsRating[0]
    if (ratingData.rating !== statementRating.rating) {
      statementRating.rating = ratingData.rating
      statementRating.updatedAt = r.now()
      let result = await r
        .table("statementsRating")
        .get(statementRating.id)
        .update(statementRating, {returnChanges: true})
      statementRating = result.changes[0].new_val
    }
  }
  ctx.body = {
    apiVersion: "1",
    data: await toStatementRatingJson(statementRating, {showVoterName: true}),
  }
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
  statementRatingJson.updatedAt = statementRatingJson.updatedAt.toISOString()
  console.log(statementRatingJson)
  return statementRatingJson
}
