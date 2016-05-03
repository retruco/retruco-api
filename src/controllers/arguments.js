// Retruco-API -- HTTP API to bring out shared positions from argumented arguments
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


async function addRatingEvent(claimId, groundId) {
  let events = await r
    .table("events")
    .getAll([claimId, groundId, "argument rating"], {index: "argumentIdAndType"})
    .limit(1)
  if (events.length < 1) {
    await r
      .table("events")
      .insert({
        claimId,
        createdAt: r.now(),
        groundId,
        type: "argument rating",
      })
  }
}


export {deleteRating}
async function deleteRating(ctx) {
  // Delete an argument rating.
  let argument = ctx.argument

  let id = [argument.claimId, argument.groundId, ctx.authenticatedUser.id].join("/")
  let argumentRating = await r
    .table("argumentsRating")
    .get(id)
  if (argumentRating === null) {
    argumentRating = {
      claimId: argument.claimId,
      groundId: argument.groundId,
      id,
      // rating: null,
      // updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
  } else {
    await r
      .table("argumentsRating")
      .get(id)
      .delete()
    await addRatingEvent(argument.claimId, argument.groundId)
  }

  ctx.body = {
    apiVersion: "1",
    data: await toArgumentRatingJson(argumentRating, {showVoterName: true}),
  }
}


export {get}
async function get(ctx) {
  // Respond an existing argument.

  ctx.body = {
    apiVersion: "1",
    data: await toArgumentJson(ctx.argument),
  }
}


export {getRating}
async function getRating(ctx) {
  // Respond an argument rating.
  let argument = ctx.argument

  let id = [argument.claimId, argument.groundId, ctx.authenticatedUser.id].join("/")
  let argumentRating = await r
    .table("argumentsRating")
    .get(id)
  if (argumentRating === null) {
    argumentRating = {
      claimId: argument.claimId,
      groundId: argument.groundId,
      id,
      // rating: null,
      // updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
  }

  ctx.body = {
    apiVersion: "1",
    data: await toArgumentRatingJson(argumentRating, {showVoterName: true}),
  }
}


export {requireArgument}
async function requireArgument(ctx, next) {
  let claimId = ctx.parameter.claimId
  let groundId = ctx.parameter.groundId
  let id = [claimId, groundId].join("/")
  let argument = await r
    .table("arguments")
    .get(id)
  // Create an argument when it is missing. Never return a 404.
  if (argument === null) {
    argument = {
      claimId,
      createdAt: r.now(),
      groundId,
      id,
    }
    let result = await r
      .table("arguments")
      .insert(argument, {returnChanges: true})
    argument = result.changes[0].new_val
  }
  ctx.argument = argument

  await next()
}


async function toArgumentJson(argument) {
  let argumentJson = {...argument}
  argumentJson.createdAt = argumentJson.createdAt.toISOString()
  delete argumentJson.id
  return argumentJson
}


async function toArgumentRatingJson(argumentRating, {showVoterName = false} = {}) {
  let argumentRatingJson = {...argumentRating}
  delete argumentRatingJson.id
  if (showVoterName && argumentRating.voterId) {
    argumentRatingJson.voterName = await r
      .table("users")
      .get(argumentRating.voterId)
      .getField("urlName")
  }
  delete argumentRatingJson.voterId
  if (argumentRatingJson.updatedAt) argumentRatingJson.updatedAt = argumentRatingJson.updatedAt.toISOString()
  return argumentRatingJson
}


export {upsertRating}
async function upsertRating(ctx) {
  // Insert or update a argument rating.
  let argument = ctx.argument
  let ratingData = ctx.parameter.ratingData

  let id = [argument.claimId, argument.groundId, ctx.authenticatedUser.id].join("/")
  let argumentRating = await r
    .table("argumentsRating")
    .get(id)
  if (argumentRating === null) {
    argumentRating = {
      claimId: argument.claimId,
      groundId: argument.groundId,
      id,
      rating: ratingData.rating,
      updatedAt: r.now(),
      voterId: ctx.authenticatedUser.id,
    }
    let result = await r
      .table("argumentsRating")
      .insert(argumentRating, {returnChanges: true})
    argumentRating = result.changes[0].new_val
    await addRatingEvent(argument.claimId, argument.groundId)
    ctx.status = 201  // Created
  } else if (ratingData.rating !== argumentRating.rating) {
    argumentRating.rating = ratingData.rating
    argumentRating.updatedAt = r.now()
    let result = await r
      .table("argumentsRating")
      .get(id)
      .update(argumentRating, {returnChanges: true})
    argumentRating = result.changes[0].new_val
    await addRatingEvent(argument.claimId, argument.groundId)
  }
  ctx.body = {
    apiVersion: "1",
    data: await toArgumentRatingJson(argumentRating, {showVoterName: true}),
  }
}
