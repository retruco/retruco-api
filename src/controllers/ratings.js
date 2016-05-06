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
import {addStatementRatingEvent} from "../model"


export {deleteRating}
async function deleteRating(ctx) {
  // Delete a statement rating.
  let statement = ctx.statement

  let id = [statement.id, ctx.authenticatedUser.id].join("/")
  let statementRating = await r
    .table("ratings")
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
      .table("ratings")
      .get(id)
      .delete()
    await addStatementRatingEvent(statement.id)
  }

  ctx.body = {
    apiVersion: "1",
    data: await toRatingJson(statementRating, {showVoterName: true}),
  }
}


export {getRating}
async function getRating(ctx) {
  // Respond an existing statement rating.
  let statement = ctx.statement

  let id = [statement.id, ctx.authenticatedUser.id].join("/")
  let statementRating = await r
    .table("ratings")
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
    data: await toRatingJson(statementRating, {showVoterName: true}),
  }
}


async function toRatingJson(statementRating, {showVoterName = false} = {}) {
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
    .table("ratings")
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
      .table("ratings")
      .insert(statementRating, {returnChanges: true})
    statementRating = result.changes[0].new_val
    await addStatementRatingEvent(statement.id)
    ctx.status = 201  // Created
  } else if (ratingData.rating !== statementRating.rating) {
    statementRating.rating = ratingData.rating
    statementRating.updatedAt = r.now()
    let result = await r
      .table("ratings")
      .get(id)
      .update(statementRating, {returnChanges: true})
    statementRating = result.changes[0].new_val
    await addStatementRatingEvent(statement.id)
  }
  ctx.body = {
    apiVersion: "1",
    data: await toRatingJson(statementRating, {showVoterName: true}),
  }
}
