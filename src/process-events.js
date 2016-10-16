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


import {checkDatabase, db, entryToBallot, entryToEvent, entryToStatement} from "./database"
import {addBallotEvent} from "./model"


async function describe(statement) {
  if (statement === null) return "missing statement" 
  const type = statement.type
  if (type === "Abuse") {
    const flaggedStatement = entryToStatement(await db.oneOrNone(
        `SELECT * FROM statements
          WHERE id = $<statementId>`,
        statement,
      ))
    const flaggedDescription = await describe(flaggedStatement)
    return `abuse for ${flaggedDescription}` 
  } else if (type === "Argument") {
    const claim = entryToStatement(await db.oneOrNone(
      `SELECT * FROM statements
        WHERE id = $<claimId>`,
      statement,
    ))
    const claimDescription = await describe(claim)
    const ground = entryToStatement(await db.oneOrNone(
      `SELECT * FROM statements
        WHERE id = $<groundId>`,
      statement,
    ))
    const groundDescription = await describe(ground)
    return `argument for ${claimDescription} based on ${groundDescription}` 
  } else if (type === "PlainStatement") {
    return `plain statement ${statement.languageCode}"${statement.name}"`
  } else if (type === "Tag") {
    const taggedStatement = entryToStatement(await db.oneOrNone(
        `SELECT * FROM statements
          WHERE id = $<statementId>`,
        statement,
      ))
    const taggedDescription = await describe(taggedStatement)
    return `tag "${statement.name}" of ${taggedDescription}` 
  } else {
    return `statement of unknown type ${type}` 
  }
}


async function processEvent(event) {
  await db.none(`DELETE FROM events WHERE id = $<id>`, event)
  if (event.type === "rating") {
    let statement = entryToStatement(await db.oneOrNone(
      `SELECT * FROM statements WHERE id = $<statementId>`,
      event,
    ))
    if (statement === null) return
    let description = await describe(statement)
    console.log(`Processing event ${event.type} of ${event.createdAt.toISOString()} for ${description}...`)

    // Compute statement rating.
    let ratingCount = 0
    let ratingSum = 0
    console.log('a')
    let ballots = (await db.any(
      `SELECT * FROM ballots WHERE statement_id = $<id>`,
      statement,
    )).map(entryToBallot)
    console.log('b')
    for (let ballot of ballots) {
      ratingCount += 1
      if (ballot.rating) ratingSum += ballot.rating
    }
    let groundArguments = (await db.any(
      `SELECT * FROM statements WHERE (data->>'claimId')::bigint = $<id>`,
      statement,
    )).map(entryToStatement)
    console.log('c')
    for (let argument of groundArguments) {
      if (!argument.isAbuse && (argument.rating || 0) > 0 && ["because", "but"].includes(argument.argumentType)) {
        console.log('d')
        let ground = entryToStatement(await db.oneOrNone(
          `SELECT * FROM statements WHERE id = $<groundId>`,
          argument,
        ))
        console.log('e')
        if (!ground.isAbuse && ground.ratingCount) {
          ratingCount += ground.ratingCount
          ratingSum += (argument.argumentType === "because" ? 1 : -1) * ground.ratingSum
        }
      }
    }

    console.log('f')
    if (ratingCount != statement.ratingCount || ratingSum != statement.ratingSum) {
      // Save statement rating.
      let rating
      if (ratingCount === 0) {
        Object.assign(statement, {
          rating: 0,
          ratingCount: 0,
          ratingSum: 0,
        })
        console.log('g')
        await db.none(
          `UPDATE statements
            SET rating = DEFAULT, rating_count = DEFAULT, rating_sum = DEFAULT
            WHERE id = $<id>`,
          statement,
        )
        console.log('h')
      } else {
        rating = ratingSum / ratingCount
        Object.assign(statement, {
          rating,
          ratingCount,
          ratingSum,
        })
        console.log('i')
        await db.none(
          `UPDATE statements
            SET rating = $<rating>, rating_count = $<ratingCount>, rating_sum = $<ratingSum>
            WHERE id = $<id>`,
          statement,
        )
        console.log('j')
      }

      // Propagate stateemnt rating change.
      let claimArguments = (await db.any(
        `SELECT * FROM statements
          WHERE (data->>'groundId')::bigint = $<id>`,
        statement,
      )).map(entryToStatement)
      for (let argument of claimArguments) {
        addBallotEvent(argument.claimId)
      }
      if (statement.type === "Abuse") {
        let flaggedEntry = await db.oneOrNone(
            `SELECT data FROM statements
              WHERE id = $<statementId>`,
            statement,
          )
        if (flaggedEntry !== null) {
          let flaggedData = flaggedEntry.data
          let isAbuse = rating !== null && rating > 0
          if (isAbuse !== Boolean(flaggedData.isAbuse)) {
            if (isAbuse) {
              flaggedData.isAbuse = true
            } else {
              delete flaggedData.isAbuse
            }
            db.none(
              `UPDATE statements
                SET data = $<data>
                WHERE id = $<id>`,
              flaggedEntry,
            )
            let claimArguments = (await db.any(
              `SELECT * FROM statements
                WHERE (data->>'groundId')::bigint = $<id>`,
              flaggedEntry,
            )).map(entryToStatement)
            for (let argument of claimArguments) {
              addBallotEvent(argument.claimId)
            }
          }
        }
      } else if (statement.type === "Argument") {
        await addBallotEvent(statement.claimId)
      } else if (statement.type === "Tag") {
        let taggedEntry = await db.oneOrNone(
            `SELECT data FROM statements
              WHERE id = $<statementId>`,
            statement,
          )
        if (taggedEntry !== null) {
          let taggedData = taggedEntry.data
          let addTag = rating !== null && rating > 0
          let tagExists = Boolean(taggedData.tags && taggedData.tags.includes(statement.name))
          if (addTag !== tagExists) {
            if (addTag) {
              if (!taggedData.tags) taggedData.tags = []
              taggedData.tags.push(statement.name)
              taggedData.tags.sort()
            } else {
              taggedData.tags.splice(taggedData.tags.indexOf(statement.name), 1)
            }
            if (taggedData.tags.length === 0) delete taggedData.tags
            db.none(
              `UPDATE statements
                SET data = $<data>
                WHERE id = $<id>`,
              taggedEntry,
            )
          }
        }
      }
    }
  } else {
    console.warn(`Unexpected event ${event.type} of ${event.createdAt.toISOString()}.`)
    // Reinsert event.
    let result = await db.one(
      `INSERT INTO events(created_at, statement_id, type)
        VALUES (current_timestamp, $<statementId>, $<type>)
        RETURNING created_at, id`,
      event,
    )
    event.createdAt = result.created_at
    event.id = result.id
  }
}


async function processEvents () {
  while (true) {
    // Handle existing pending events.
    let events = (await db.any(`SELECT * FROM events ORDER BY created_at`)).map(entryToEvent)
    for (let event of events) {
      await processEvent(event)
    }
    await db.none(`LISTEN $1~`, 'new_event')
  }
}


checkDatabase()
  .then(processEvents)
  .catch(error => console.log(error.stack))
