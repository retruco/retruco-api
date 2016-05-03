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


import {checkDatabase, r} from "./database"


async function processEvent(event) {
  await r
    .table("events")
    .get(event.id)
    .delete()
  if (event.type === "argument rating") {
    let claim = await r
      .table("statements")
      .get(event.claimId)
    let ground = await r
      .table("statements")
      .get(event.groundId)
    console.log(`Processing event ${event.type} of ${event.createdAt.toISOString()} for claim` +
      ` ${claim.languageCode}"${claim.name}" based on ground ${ground.languageCode}"${ground.name}"...`)
    let argumentsRating = await r
      .table("argumentsRating")
      .getAll([claim.id, ground.id], {index: "argumentId"})
    let ratingCount = 0
    let ratingSum = 0
    for (let argumentRating of argumentsRating) {
      if (argumentRating.rating) {
        ratingCount += 1
        ratingSum += argumentRating.rating
      }
    }
    let rating = ratingCount === 0 ? null : ratingSum / ratingCount
    await r
      .table("arguments")
      .get([claim.id, ground.id].join("/"))
      .update({rating})
  } else if (event.type === "statement rating") {
    let statement = await r
      .table("statements")
      .get(event.statementId)
    console.log(`Processing event ${event.type} of ${event.createdAt.toISOString()} for statement` +
      ` ${statement.languageCode}"${statement.name}"...`)
    let statementsRating = await r
      .table("statementsRating")
      .getAll(statement.id, {index: "statementId"})
    let ratingCount = 0
    let ratingSum = 0
    for (let statementRating of statementsRating) {
      if (statementRating.rating) {
        ratingCount += 1
        ratingSum += statementRating.rating
      }
    }
    let rating = ratingCount === 0 ? null : ratingSum / ratingCount
    await r
      .table("statements")
      .get(statement.id)
      .update({rating})
  } else {
    console.warn(`Unexpected event ${event.type} of ${event.createdAt.toISOString()}.`)
    // Reinsert event.
    await r
      .table("events")
      .insert(event)
  }
}


async function processEvents () {
  // First, prepare to handle new pending actions.
  // Don't await, because we want to process existing pending actions now.
  processNewEvents().catch(error => console.log(error.stack))

  // Handle existing pending events.
  let events = await r
    .table("events")
    .orderBy({index: r.desc("createdAt")})
  for (let event of events) {
    await processEvent(event)
  }
}


async function processNewEvents() {
  // Handle new pending events.
  let cursor = await r
    .table("events")
    .changes()
    .run({cursor: true})
  // Note: Don't use cursor.each(function), to process pending events one at a time.
  while (true) {
    let change = await cursor.next()
    let event = change.new_val
    if (event !== null) {
      await processEvent(event)
    }
  }
}


checkDatabase()
  .then(processEvents)
  .catch(error => console.log(error.stack))
