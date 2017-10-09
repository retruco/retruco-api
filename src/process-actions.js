// Retruco-API -- HTTP API to bring out shared positions from argumented statements
// By: Paula Forteza <paula@retruco.org>
//     Emmanuel Raviart <emmanuel@retruco.org>
//
// Copyright (C) 2016, 2017 Paula Forteza & Emmanuel Raviart
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

import { checkDatabase, db, dbSharedConnectionObject } from "./database"
import { sendMatrixMessage } from "./matrix"
import {
  addAction,
  addReferences,
  describe,
  describeHtml,
  generateObjectTextSearch,
  getObjectFromId,
  getSubTypeIdsFromProperties,
  getTagIdsFromProperties,
  entryToAction,
  entryToBallot,
  entryToProperty,
} from "./model"
import { regenerateArguments, regeneratePropertiesItem } from "./regenerators"
import { getIdFromSymbol, debateKeySymbols } from "./symbols"

let conAndProKeyIds = null // Set by processActions
let debateKeyIds = null // Set by processActions
let conId = null // Set by processActions
let proId = null // Set by processActions
let trashedKeyId = null // Set by processActions
let trueId = null // Set by processActions
const trendingStartTime = new Date(2016, 12, 1) / 1000

async function processAction(action) {
  // TODO: action.type is not handled. It should be removed.

  await db.none("DELETE FROM actions WHERE id = $<id>", action)
  let object = await getObjectFromId(action.objectId)
  if (object === null) return
  let description = await describe(object)
  console.log(`Processing ${action.type} of ${action.createdAt.toISOString()} for ${description}...`)

  // Compute object references from properties.
  let contentChanged = false
  let properties = object.properties || {}
  let referencedIds = new Set()
  let textSearchUpdateNeeded = false
  for (let valueIds of Object.values(properties)) {
    if (!Array.isArray(valueIds)) {
      // valueIds is a single ID.
      valueIds = [valueIds]
    }
    for (let valueId of valueIds) {
      let typedValue = await getObjectFromId(valueId)
      if (typedValue === null) {
        console.log("Skipping missing property value:", valueId)
        continue
      }
      let schema = (await getObjectFromId(typedValue.schemaId)).value
      if (schema === undefined) {
        console.log("Skipping property value without schema:", typedValue)
        continue
      }
      await addReferences(referencedIds, schema, typedValue.value)
    }
  }
  referencedIds.delete(object.id) // Remove reference to itself.

  let newReferencedIds = new Set(referencedIds)
  let existingReferencedIds = new Set(
    (await db.any("SELECT target_id FROM objects_references WHERE source_id = $1", object.id)).map(
      entry => entry.target_id,
    ),
  )
  for (let referencedId of referencedIds) {
    if (existingReferencedIds.has(referencedId)) {
      existingReferencedIds.delete(referencedId)
      newReferencedIds.delete(referencedId)
    }
  }
  if (existingReferencedIds.size > 0) {
    await db.none("DELETE FROM objects_references WHERE source_id = $<sourceId> AND target_id in ($<targetIds:csv>)", {
      sourceId: object.id,
      targetIds: [...existingReferencedIds],
    })
    contentChanged = true
  }
  if (newReferencedIds.size > 0) {
    for (let referencedId of newReferencedIds) {
      await db.none("INSERT INTO objects_references(source_id, target_id) VALUES ($<sourceId>, $<targetId>)", {
        sourceId: object.id,
        targetId: referencedId,
      })
    }
    contentChanged = true
  }

  // Compute object sub types from properties.
  let subTypeIds = await getSubTypeIdsFromProperties(properties)
  if (!deepEqual(subTypeIds, object.subTypeIds)) {
    await db.none("UPDATE objects SET sub_types = $<subTypeIds> WHERE id = $<id>", {
      id: object.id,
      subTypeIds,
    })
    contentChanged = true
    textSearchUpdateNeeded = true
    // await addAction(object.id, "update")  TODO?
  }

  // Compute object usage tags for OGP toolbox tools.
  let referencerIds = new Set(
    (await db.any("SELECT source_id FROM objects_references WHERE target_id = $1", object.id)).map(
      entry => entry.source_id,
    ),
  )
  let referenceIds = new Set([...referencedIds, ...referencerIds])
  let usageIds = null
  if (referenceIds.size > 0) {
    usageIds = (await db.any(
      `
        SELECT DISTINCT unnest(tags) AS tag
        FROM objects
        WHERE id in ($1:csv)
        AND sub_types && $2
        ORDER BY tag
      `,
      [[...referenceIds].sort(), [getIdFromSymbol("use-case")]],
    )).map(entry => entry.tag)
    if (usageIds.length === 0) usageIds = null
  }
  if (!deepEqual(usageIds, object.usageIds)) {
    await db.none("UPDATE objects SET usages = $<usageIds> WHERE id = $<id>", {
      id: object.id,
      usageIds,
    })
    contentChanged = true
    textSearchUpdateNeeded = true
    // await addAction(object.id, "update")  TODO?
  }

  // Compute object tags from properties.
  let tagIds = await getTagIdsFromProperties(properties)
  // Add usage to tags, to index them.
  if (usageIds !== null) {
    if (tagIds === null) tagIds = usageIds
    else tagIds = [...new Set([...tagIds, ...usageIds])].sort()
  }
  if (!deepEqual(tagIds, object.tagIds)) {
    await db.none("UPDATE objects SET tags = $<tagIds> WHERE id = $<id>", {
      id: object.id,
      tagIds,
    })
    contentChanged = true
    textSearchUpdateNeeded = true
    // await addAction(object.id, "update")  TODO?
  }

  let ratingChanged = false
  let trashedChanged = false
  if (object.ratingSum !== undefined) {
    // object is a statement (aka a rated object)
    // Compute statement rating.
    // Note: Don't forget to update https://forum.ogptoolbox.org/t/ogptoolbox-rating-algorithm/29 when the algorithm
    // changes.
    let ratingCount = 0
    let ratingSum = 0
    let ballots = (await db.any("SELECT * FROM ballots WHERE statement_id = $<id>", object)).map(entryToBallot)
    for (let ballot of ballots) {
      ratingCount += 1
      if (ballot.rating) ratingSum += ballot.rating
    }
    let conAndPropProperties = (await db.any(
      `
        SELECT objects.*, statements.*, properties.*, symbol
        FROM objects
        INNER JOIN statements ON objects.id = statements.id
        INNER JOIN properties ON statements.id = properties.id
        LEFT JOIN symbols ON properties.id = symbols.id
        WHERE properties.object_id = $<objectId>
        AND properties.key_id IN ($<conAndProKeyIds:csv>)
        AND NOT statements.trashed
        AND statements.rating_sum > 0
        ORDER BY rating_sum DESC, created_at DESC
      `,
      {
        conAndProKeyIds,
        objectId: object.id,
      },
    )).map(entryToProperty)
    for (let debateProperty of conAndPropProperties) {
      ratingCount += debateProperty.ratingCount
      ratingSum +=
        (debateProperty.keyId === conId ? -1 : debateProperty.keyId === proId ? 1 : 0) * debateProperty.ratingSum
    }

    if (object.type === "Card") {
      // Compute card specific rating.
      let keyIds = Object.keys(object.properties || {})
      // When there is at least 5 properties, score is multiplied by up to two.
      let ogpToolboxScore = Math.atan(keyIds.length / 5) * 4 / Math.PI
      if (keyIds.includes(getIdFromSymbol("logo")) || keyIds.includes(getIdFromSymbol("screenshot"))) {
        ogpToolboxScore *= 10
      }
      let referencesCount = Number(
        (await db.one("SELECT count(*) AS count FROM objects_references WHERE target_id = $<id>", object)).count,
      )
      ogpToolboxScore *= Math.max(referencesCount, 0.5)
      let locationsCount = 0
      let locationsId = (object.properties || {})[getIdFromSymbol("location")]
      if (locationsId) {
        let typedLocation = await getObjectFromId(locationsId)
        if (typedLocation !== null && typedLocation.schemaId === getIdFromSymbol("schema:ids-array")) {
          locationsCount = typedLocation.value.length
        }
      }
      ogpToolboxScore *= Math.max(locationsCount, 1)

      // if ((object.subTypeIds || []).includes(getIdFromSymbol("software"))) {}

      ogpToolboxScore = Math.round(ogpToolboxScore)
      ratingCount += ogpToolboxScore
      ratingSum += ogpToolboxScore
    } else if (object.type == "Property") {
      // When property is a pro or con and its ground (aka its value) is not valid, the property is also not valid.
      if (conAndProKeyIds.includes(object.keyId)) {
        let ground = await getObjectFromId(object.valueId)
        if (ground === null || ground.trashed || ground.ratingSum === undefined || ground.ratingSum <= 0) {
          ratingSum = 0
        }
      }
    }

    if (action.type === "reset" || ratingCount != object.ratingCount || ratingSum != object.ratingSum) {
      ratingChanged = true

      if (action.type !== "reset") {
        sendMatrixMessage(
          `${await describeHtml(
            object,
          )} rating has changed from ${object.ratingSum}/${object.ratingCount} to ${ratingSum}/${ratingCount}.`,
        )
      }

      let rating
      if (ratingCount === 0) {
        object = {
          ...object,
          rating: 0,
          ratingCount: 0,
          ratingSum: 0,
          trending: 0,
        }
        await db.none(
          `
            UPDATE statements
            SET rating = DEFAULT, rating_count = DEFAULT, rating_sum = DEFAULT, trending = DEFAULT
            WHERE id = $<id>
          `,
          object,
        )
      } else {
        rating = ratingSum / ratingCount

        // Compute trending rating using Reddit formula.
        // Cf https://moz.com/blog/reddit-stumbleupon-delicious-and-hacker-news-algorithms-exposed
        let trending =
          Math.log10(Math.max(ratingSum, 1)) +
          Math.sign(ratingSum) * (object.createdAt / 1000 - trendingStartTime) / 45000

        object = {
          ...object,
          rating,
          ratingCount,
          ratingSum,
          trending,
        }
        await db.none(
          `
            INSERT INTO statements(id, rating, rating_count, rating_sum, trending)
            VALUES ($<id>, $<rating>, $<ratingCount>, $<ratingSum>, $<trending>)
            ON CONFLICT (id)
            DO UPDATE
            SET rating = $<rating>, rating_count = $<ratingCount>, rating_sum = $<ratingSum>, trending = $<trending>
          `,
          object,
        )
      }

      if (object.type === "Property") {
        await regeneratePropertiesItem(object.objectId, object.keyId)
        if (debateKeyIds.includes(object.keyId)) {
          await regenerateArguments(object.objectId, debateKeyIds)
        }
      }
    }

    // Compute trashed attribute.
    let trashedProperty = entryToProperty(
      await db.oneOrNone(
        `
        SELECT objects.*, statements.*, properties.*, symbol
        FROM objects
        INNER JOIN statements ON objects.id = statements.id
        INNER JOIN properties ON statements.id = properties.id
        LEFT JOIN symbols ON properties.id = symbols.id
        WHERE properties.object_id = $<objectId>
        AND properties.key_id = $<trashedKeyId>
        AND properties.value_id = $<trueId>
        AND NOT statements.trashed
        AND statements.rating_sum > 0
        LIMIT 1
      `,
        {
          trashedKeyId,
          trueId,
          objectId: object.id,
        },
      ),
    )
    let trashed = trashedProperty !== null
    if (trashed !== object.trashed) {
      trashedChanged = true
      object.trashed = trashed
      await db.none(
        `
          UPDATE statements
          SET trashed = $<trashed>
          WHERE id = $<id>
        `,
        object,
      )
      sendMatrixMessage(`${await describeHtml(object)} has been ${trashed ? "" : "un"}trashed.`)
    }
  }

  if (textSearchUpdateNeeded) {
    await generateObjectTextSearch(object)
  }

  if (ratingChanged || trashedChanged) {
    // Propagate to every objects referenced by or referencing current object.
    for (let referenceId of referenceIds) {
      addAction(referenceId, action.type)
    }
    if (object.type === "Property") {
      addAction(object.objectId, action.type)
    }
  } else if (contentChanged) {
    // Propagate change to every reference of object.
    for (let referencedId of referencedIds) {
      addAction(referencedId, action.type)
    }
  }
}

async function processActions() {
  conId = getIdFromSymbol("con")
  proId = getIdFromSymbol("pro")
  conAndProKeyIds = [conId, proId]
  debateKeyIds = debateKeySymbols.map(getIdFromSymbol)
  trashedKeyId = getIdFromSymbol("trashed")
  trueId = getIdFromSymbol("true")

  let processingActions = false

  dbSharedConnectionObject.client.on("notification", async data => {
    try {
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
    } catch (error) {
      console.log(error.stack || error)
      process.exit(1)
    }
  })

  // Wait for new actions.
  await dbSharedConnectionObject.none("LISTEN $1~", "new_action")

  // Notify new_action to process pending actions.
  db.none("NOTIFY new_action")
}

checkDatabase().then(processActions).catch(error => {
  console.log(error.stack || error)
  process.exit(1)
})
