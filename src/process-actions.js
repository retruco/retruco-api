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


import assert from "assert"
import deepEqual from "deep-equal"

import {checkDatabase, db, dbSharedConnectionObject, entryToAction, entryToBallot, entryToStatement,
  generateStatementTextSearch} from "./database"
import {addBallotAction} from "./model"


function addRatedValue(requestedSchemaType, values, schema, value) {
  assert(requestedSchemaType !== "array")
  let schemaType = schema.type
  if (schemaType === "array") {
    for (let itemValue of value) {
      addRatedValue(requestedSchemaType, values, schema.items.type, itemValue)
    }
  } else if (schemaType === requestedSchemaType) {
    values.add(value)
  }
}


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
  } else if (type === "Card") {
    return `card ${statement.id}`
  } else if (type === "PlainStatement") {
    return `plain statement ${statement.languageCode}"${statement.name}"`
  } else if (type === "Property") {
    return `property ${statement.name} = ${statement.value}`
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


async function processAction(action) {
  await db.none("DELETE FROM actions WHERE id = $<id>", action)
  if (action.type === "rating") {
    let statement = entryToStatement(await db.oneOrNone(
      "SELECT * FROM statements WHERE id = $<statementId>",
      action,
    ))
    if (statement === null) return
    let description = await describe(statement)
    console.log(`Processing ${action.type} of ${action.createdAt.toISOString()} for ${description}...`)

    // Compute statement rating.
    let ratingCount = 0
    let ratingSum = 0
    let ballots = (await db.any(
      "SELECT * FROM ballots WHERE statement_id = $<id>",
      statement,
    )).map(entryToBallot)
    for (let ballot of ballots) {
      ratingCount += 1
      if (ballot.rating) ratingSum += ballot.rating
    }
    let groundArguments = (await db.any(
      "SELECT * FROM statements WHERE (data->>'claimId')::bigint = $<id>",
      statement,
    )).map(entryToStatement)
    for (let argument of groundArguments) {
      if (!argument.isAbuse && (argument.rating || 0) > 0 && ["because", "but"].includes(argument.argumentType)) {
        let ground = entryToStatement(await db.oneOrNone(
          "SELECT * FROM statements WHERE id = $<groundId>",
          argument,
        ))
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
        Object.assign(statement, {
          rating: 0,
          ratingCount: 0,
          ratingSum: 0,
        })
        await db.none(
          `UPDATE statements
            SET rating = DEFAULT, rating_count = DEFAULT, rating_sum = DEFAULT
            WHERE id = $<id>`,
          statement,
        )
      } else {
        rating = ratingSum / ratingCount
        Object.assign(statement, {
          rating,
          ratingCount,
          ratingSum,
        })
        await db.none(
          `UPDATE statements
            SET rating = $<rating>, rating_count = $<ratingCount>, rating_sum = $<ratingSum>
            WHERE id = $<id>`,
          statement,
        )
      }

      // Propagate statement rating change.
      let claimArguments = (await db.any(
        `SELECT * FROM statements
          WHERE (data->>'groundId')::bigint = $<id>`,
        statement,
      )).map(entryToStatement)
      for (let argument of claimArguments) {
        addBallotAction(argument.claimId)
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
            await db.none(
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
              addBallotAction(argument.claimId)
            }
          }
        }
      } else if (statement.type === "Argument") {
        await addBallotAction(statement.claimId)
      } else if (statement.type === "Property") {
        let cardEntry = await db.oneOrNone(
            `SELECT * FROM statements
              WHERE id = $<statementId>`,
            statement,
        )
        if (cardEntry !== null) {
          let sameNameProperties = (await db.any(
            `SELECT * FROM statements
              WHERE type = 'Property'
              AND (data->>'statementId')::bigint = $<cardId>
              AND data->>'name' = $<propertyName>
              ORDER BY rating DESC, id DESC`,
            {
              cardId: cardEntry.id,
              propertyName: statement.name,
            },
          )).map(entryToStatement)
          let cardData = cardEntry.data
          let oldCardData = JSON.parse(JSON.stringify(cardData))
          let removeAttribute = true
          if (sameNameProperties.length > 0) {
            // TODO: Improve search of best property. For example, if any of the best rated properties is of type
            // "rated set", it wins even when it is not the oldest (lowest id).
            let bestProperty = sameNameProperties[0]
            let bestRating = bestProperty.rating
            if (bestRating > 0) {
              // Sometimes the best property is not the oldest of the best rated properties.
              for (let property of sameNameProperties) {
                if (property.rating < bestRating) break
                if (property.widget.tag === "RatedSet") {
                  let requestedSchemaType = property.schema.type
                  let ratedValues = new Set()
                  for (let property1 of sameNameProperties) {
                    if (property1.rating <= 0) break
                    addRatedValue(requestedSchemaType, ratedValues, property1.schema, property1.value)
                  }
                  bestProperty = {
                    schema: property.schema,
                    value: [...ratedValues].sort(),
                    widget: property.widget,
                  }
                  break
                }
              }

              removeAttribute = false
              if (!cardData.values) cardData.values = {}
              cardData.values[bestProperty.name] = bestProperty.value
              if (!cardData.schemas) cardData.schemas = {}
              cardData.schemas[bestProperty.name] = bestProperty.schema
              if (!cardData.widgets) cardData.widgets = {}
              cardData.widgets[bestProperty.name] = bestProperty.widget
            }
          }
          if (removeAttribute) {
            if (cardData.values) {
              delete cardData.values[statement.name]
              if (Object.keys(cardData.values).length === 0) delete cardData.values
            }
            if (cardData.schemas) {
              delete cardData.schemas[statement.name]
              if (Object.keys(cardData.schemas).length === 0) delete cardData.schemas
            }
            if (cardData.widgets) {
              delete cardData.widgets[statement.name]
              if (Object.keys(cardData.widgets).length === 0) delete cardData.widgets
            }
          }
          if (!deepEqual(cardData, oldCardData)) {
            await db.none(
              `UPDATE statements
                SET data = $<data>
                WHERE id = $<id>`,
              cardEntry,
            )
            await generateStatementTextSearch(entryToStatement(cardEntry))
          }
        }
      } else if (statement.type === "Tag") {
        let taggedEntry = await db.oneOrNone(
            `SELECT * FROM statements
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
            await db.none(
              `UPDATE statements
                SET data = $<data>
                WHERE id = $<id>`,
              taggedEntry,
            )
            await generateStatementTextSearch(entryToStatement(taggedEntry))
          }
        }
      }
    }
  } else {
    console.warn(`Unexpected action ${action.type} of ${action.createdAt.toISOString()}.`)
    // Reinsert action.
    let result = await db.one(
      `INSERT INTO actions(created_at, statement_id, type)
        VALUES (current_timestamp, $<statementId>, $<type>)
        RETURNING created_at, id`,
      action,
    )
    action.createdAt = result.created_at
    action.id = result.id
  }
}


async function processActions () {
  let processingActions = false

  dbSharedConnectionObject.client.on("notification", async data => {
    if (data.channel === "new_action") {
      if (!processingActions) {
        processingActions = true
        console.log("### Processing new actions...")
        while (true) {
          let actions = (await db.any("SELECT * FROM actions ORDER BY created_at")).map(entryToAction)
          if (actions.length === 0) break
          for (let action of actions) {
            await processAction(action)
          }
        }
        processingActions = false
        console.log("### All actions processed.")
        if ((await db.one("SELECT EXISTS (SELECT 1 FROM actions)")).exists) {
          // Some actions have been created in the mean time...
          db.none("NOTIFY new_action")
        }
      }
    } else {
      console.log(`Ignoring unknown channel "${data.channel}" (in notification: $}{data}).`)
    }
  })

  // Wait for new actions.
  await dbSharedConnectionObject.none("LISTEN $1~", "new_action")

  // Notify new_action to process pending actions.
  db.none("NOTIFY new_action")
}


checkDatabase()
  .then(processActions)
  .catch(error => {
    console.log(error.stack)
    process.exit(1)
  })
