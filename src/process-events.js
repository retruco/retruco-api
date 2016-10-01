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


import {checkDatabase, r} from "./database"
import {addBallotEvent} from "./model"


async function describe(statement) {
  if (statement === null) return "missing statement" 
  const type = statement.type
  if (type === "Abuse") {
    const flaggedStatement = await r
      .table("statements")
      .get(statement.statementId)
    const flaggedDescription = await describe(flaggedStatement)
    return `abuse for ${flaggedDescription}` 
  } else if (type === "Argument") {
    const claim = await r
      .table("statements")
      .get(statement.claimId)
    const claimDescription = await describe(claim)
    const ground = await r
      .table("statements")
      .get(statement.groundId)
    const groundDescription = await describe(ground)
    return `argument for ${claimDescription} based on ${groundDescription}` 
  } else if (type === "PlainStatement") {
    return `plain statement ${statement.languageCode}"${statement.name}"`
  } else if (type === "Tag") {
    const taggedStatement = await r
      .table("statements")
      .get(statement.statementId)
    const taggedDescription = await describe(taggedStatement)
    return `tag "${statement.name}" of ${taggedDescription}` 
  } else {
    return `statement of unknown type ${type}` 
  }
}


async function processEvent(event) {
  await r
    .table("events")
    .get(event.id)
    .delete()
  if (event.type === "rating") {
    let statement = await r
      .table("statements")
      .get(event.statementId)
    if (statement === null) return
    let description = await describe(statement)
    console.log(`Processing event ${event.type} of ${event.createdAt.toISOString()} for ${description}...`)

    // Compute statement rating.
    let ratingCount = 0
    let ratingSum = 0
    let ballots = await r
      .table("ballots")
      .getAll(statement.id, {index: "statementId"})
    for (let ballot of ballots) {
      ratingCount += 1
      if (ballot.rating) ratingSum += ballot.rating
    }
    let groundArguments = await r
      .table("statements")
      .getAll(statement.id, {index: "claimId"})
    for (let argument of groundArguments) {
      if (!argument.isAbuse && (argument.rating || 0) > 0 && ["because", "but"].includes(argument.argumentType)) {
        let ground = await r
          .table("statements")
          .get(argument.groundId)
        if (!ground.isAbuse && ground.ratingCount) {
          ratingCount += ground.ratingCount
          ratingSum += (argument.argumentType === "because" ? 1 : -1) * ground.ratingSum
        }
      }
    }

    if (ratingCount != statement.ratingCount || ratingSum != statement.ratingSum) {
      // Save statement rating.
      let rating
      if (ratingCount === 0) {
        rating = null
        await r
          .table("statements")
          .get(statement.id)
          .replace(r.row.without("rating", "ratingCount", "ratingSum"))
      } else {
        rating = ratingSum / ratingCount
        await r
          .table("statements")
          .get(statement.id)
          .update({
            rating,
            ratingCount,
            ratingSum,        
          })
      }

      // Propagate stateemnt rating change.
      let claimArguments = await r
        .table("statements")
        .getAll(statement.id, {index: "groundId"})
      for (let argument of claimArguments) {
        addBallotEvent(argument.claimId)
      }
      if (statement.type === "Abuse") {
        let flaggedStatement = await r
          .table("statements")
          .get(statement.statementId)
        if (flaggedStatement !== null) {
          let isAbuse = rating !== null && rating > 0
          if (isAbuse !== Boolean(flaggedStatement.isAbuse)) {
            if (isAbuse) {
              await r
                .table("statements")
                .get(flaggedStatement.id)
                .update({isAbuse})
            } else {
              await r
                .table("statements")
                .get(flaggedStatement.id)
                .replace(r.row.without("isAbuse"))
            }
            claimArguments = await r
              .table("statements")
              .getAll(flaggedStatement.id, {index: "groundId"})
            for (let argument of claimArguments) {
              addBallotEvent(argument.claimId)
            }
          }
        }
      } else if (statement.type === "Argument") {
        await addBallotEvent(statement.claimId)
      } else if (statement.type === "Tag") {
        let taggedStatement = await r
          .table("statements")
          .get(statement.statementId)
        if (taggedStatement !== null) {
          let addTag = rating !== null && rating > 0
          let tagExists = Boolean(taggedStatement.tags && taggedStatement.tags.includes(statement.name))
          if (addTag !== tagExists) {
            if (addTag) {
              if (!taggedStatement.tags) taggedStatement.tags = []
              taggedStatement.tags.push(statement.name)
              taggedStatement.tags.sort()
            } else {
              taggedStatement.tags.splice(taggedStatement.tags.indexOf(statement.name), 1)
            }
            if (taggedStatement.tags.length > 0) {
              await r
                .table("statements")
                .get(taggedStatement.id)
                .update({tags: taggedStatement.tags})
            } else {
              await r
                .table("statements")
                .get(taggedStatement.id)
                .replace(r.row.without("tags"))
            }
          }
        }
      }
    }
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
