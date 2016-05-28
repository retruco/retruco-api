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
import {addBallotEvent, toBallotJson} from "../model"


export {deleteRating}
async function deleteRating(ctx) {
  // Delete a statement rating.
  let statement = ctx.statement

  let id = [statement.id, ctx.authenticatedUser.id].join("/")
  let ballot = await r
    .table("ballots")
    .get(id)
  if (ballot === null) {
    ballot = {
      id,
      // rating: null,
      statementId: statement.id,
      // updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
  } else {
    await r
      .table("ballots")
      .get(id)
      .delete()
    await addBallotEvent(statement.id)
  }

  ctx.body = {
    apiVersion: "1",
    data: await toBallotJson(ballot),
  }
}


export {getRating}
async function getRating(ctx) {
  // Respond an existing statement rating.
  let statement = ctx.statement

  let id = [statement.id, ctx.authenticatedUser.id].join("/")
  let ballot = await r
    .table("ballots")
    .get(id)
  if (ballot === null) {
    ballot = {
      id,
      // rating: null,
      statementId: statement.id,
      // updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
  }

  ctx.body = {
    apiVersion: "1",
    data: await toBallotJson(ballot),
  }
}


export {upsertRating}
async function upsertRating(ctx) {
  // Insert or update a statement rating.
  let statement = ctx.statement
  let ratingData = ctx.parameter.ratingData

  let id = [statement.id, ctx.authenticatedUser.id].join("/")
  let ballot = await r
    .table("ballots")
    .get(id)
  if (ballot === null) {
    ballot = {
      id,
      rating: ratingData.rating,
      statementId: statement.id,
      updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
    let result = await r
      .table("ballots")
      .insert(ballot, {returnChanges: true})
    ballot = result.changes[0].new_val
    await addBallotEvent(statement.id)
    ctx.status = 201  // Created
  } else if (ratingData.rating !== ballot.rating) {
    ballot.rating = ratingData.rating
    ballot.updatedAt = r.now()
    let result = await r
      .table("ballots")
      .get(id)
      .update(ballot, {returnChanges: true})
    ballot = result.changes[0].new_val
    await addBallotEvent(statement.id)
  }
  ctx.body = {
    apiVersion: "1",
    data: await toBallotJson(ballot),
  }
}
