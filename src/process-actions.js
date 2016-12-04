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

import config from "./config"
import {checkDatabase, db, dbSharedConnectionObject} from "./database"
import {addAction, addReferences, describe, generateObjectTextSearch, getObjectFromId, getOrNewValue,
  getSubTypeIdsFromProperties, getTagIdsFromProperties, entryToAction, entryToBallot} from "./model"
import {getIdFromSymbol, getValueFromSymbol, idBySymbol} from "./symbols"


let languageByKeyId = null
let localizationKeysId = null


function addRatedValue(requestedSchema, values, schema, value) {
  assert(requestedSchema.type !== "array")
  if (schema.type === "array") {
    if (Array.isArray(schema.items)) {
      for (let [index, itemValue] of value.entries()) {
        addRatedValue(requestedSchema, values, schema.items[index], itemValue)
      }
    } else {
      for (let itemValue of value) {
        addRatedValue(requestedSchema, values, schema.items, itemValue)
      }
    }
  } else if (schema.$ref === requestedSchema.$ref && schema.type === requestedSchema.type) {
    if (values.every(item => !deepEqual(item, value))) {
      values.push(value)
    }
  }
}


async function handlePropertyChange(objectId, keyId) {
  let object = await getObjectFromId(objectId)
  assert.ok(object, `Missing objet at ID ${objectId}`)

  // Retrieve all the properties of the card having the same key.
  let sameKeyDescriptions = (await db.any(
    `
      SELECT objects.id, rating, rating_count, rating_sum, schemas.id as schema_id, schemas.value AS schema,
        widgets.id as widget_id, widgets.value AS widget, values.id as value_id, values.value
      FROM objects
      INNER JOIN statements ON objects.id = statements.id
      INNER JOIN properties ON statements.id = properties.id
      INNER JOIN values ON properties.value_id = values.id
      INNER JOIN values AS schemas ON values.schema_id = schemas.id
      LEFT JOIN values AS widgets ON values.widget_id = widgets.id
      WHERE properties.object_id = $<objectId>
      AND properties.key_id = $<keyId>
    `,
    {
      keyId,
      objectId,
    },
  )).map(description => {
    description.ratingCount = description.rating_count
    delete description.rating_count
    description.ratingSum = description.rating_sum
    delete description.rating_sum
    description.schemaId = description.schema_id
    delete description.schema_id
    description.valueId = description.value_id
    delete description.value_id
    description.widgetId = description.widget_id
    delete description.widget_id
    return description
  })

  // Add inverse properties of bijective URI references.
  let inverseDescriptions = (await db.any(
    `
      SELECT objects.id, object_id as value, rating, rating_count, rating_sum FROM objects
      INNER JOIN statements ON objects.id = statements.id
      INNER JOIN properties ON statements.id = properties.id
      INNER JOIN values ON properties.value_id = values.id
      INNER JOIN values AS schemas ON values.schema_id = schemas.id
      WHERE (schemas.value->>'$ref') = '/schemas/bijective-card-reference'
      AND (values.value->>'targetId') = $<objectId>::text
      AND (values.value->>'reverseKeyId') = $<keyId>::text
    `,
    {
      keyId,
      objectId,
    },
  )).map(description => {
    description.ratingCount = description.rating_count
    delete description.rating_count
    description.ratingSum = description.rating_sum
    delete description.rating_sum
    description.schema = getValueFromSymbol("schema:card-id")
    description.schemaId = getIdFromSymbol("schema:card-id")
    description.valueId = null
    description.widget = getValueFromSymbol("widget:rated-item-or-set")
    description.widgetId = getIdFromSymbol("widget:rated-item-or-set")
    return description
  })
  sameKeyDescriptions = sameKeyDescriptions.concat(inverseDescriptions)

  // Add inverse properties of arrays of bijective URI references.
  let entries = (await db.any(
    `
      SELECT objects.id, object_id AS value, rating, rating_count, rating_sum, schemas.value AS schema,
        values.value AS values
      FROM objects
      INNER JOIN statements ON objects.id = statements.id
      INNER JOIN properties ON statements.id = properties.id
      INNER JOIN values ON properties.value_id = values.id
      INNER JOIN values AS schemas ON values.schema_id = schemas.id
      WHERE (schemas.value->>'type') = 'array'
      AND (schemas.value->'items') @> '{"$ref": "/schemas/bijective-card-reference"}'
      AND values.value @> '{"reverseKeyId": $<keyId~>, "targetId": $<objectId~>}'
    `,
    {
      keyId,
      objectId,
    },
  ))
  for (let entry of entries) {
    let schemaItems = entry.schema.items
    if (Array.isArray(schemaItems)) {
      for (let itemSchema of schemaItems) {
        if (itemSchema.$ref === "/schemas/bijective-card-reference") {
          // let itemValue = entry.values[index]
          sameKeyDescriptions.push({
            id: entry.id,
            rating: entry.rating,
            ratingCount: entry.rating_count,
            ratingSum: entry.rating_sum,
            schema: getValueFromSymbol("schema:card-id"),
            schemaId: getIdFromSymbol("schema:card-id"),
            value: entry.value,
            valueId: null,
            widget: getValueFromSymbol("widget:rated-item-or-set"),
            widgetId: getIdFromSymbol("widget:rated-item-or-set"),
          })
        }
      }
    } else {
      let itemSchema =  schemaItems
      if (itemSchema.$ref === "/schemas/bijective-card-reference") {
        for (let itemValue of entry.values) {
          sameKeyDescriptions.push({
            id: entry.id,
            rating: entry.rating,
            ratingCount: entry.rating_count,
            ratingSum: entry.rating_sum,
            schema: getValueFromSymbol("schema:card-id"),
            schemaId: getIdFromSymbol("schema:card-id"),
            value: entry.value,
            valueId: null,
            widget: getValueFromSymbol("widget:rated-item-or-set"),
            widgetId: getIdFromSymbol("widget:rated-item-or-set"),
          })
        }
      }
    }
  }

  // Sort properties by decreasing rating and id.
  sameKeyDescriptions.sort(function (a, b) {
    if (a.rating > b.rating) return -1
    else if (a.rating < b.rating) return 1
    else {
      let aId = parseInt(a.id)
      let bId = parseInt(b.id)
      if (aId > bId) return -1
      else if (aId < bId) return 1
      else return 0
    }
  })

  let objectPropertiesChanged = false
  let removeAttribute = true
  if (sameKeyDescriptions.length > 0) {
    // TODO: Improve search of best property. For example, if any of the best rated properties is of type
    // "RatedItemOrSet", it wins even when it is not the oldest (lowest id).
    let bestDescription = sameKeyDescriptions[0]
    let bestRating = bestDescription.rating
    if (bestRating > 0) {
      // Sometimes the best property is not the oldest of the best rated properties.
      for (let description of sameKeyDescriptions) {
        if (description.rating < bestRating) break
        if (description.widget && description.widget.tag === "RatedItemOrSet") {
          let requestedSchema = description.schema
          if (requestedSchema.type === "array") {
            requestedSchema = (Array.isArray(requestedSchema.items)) ? requestedSchema.items[0] : requestedSchema.items
          }
          let ratedValues = []
          for (let description1 of sameKeyDescriptions) {
            if (description1.rating <= 0) break
            addRatedValue(requestedSchema, ratedValues, description1.schema, description1.value)
          }
          if (ratedValues.length === 0) {
            requestedSchema = {type: null}
            ratedValues = null
          } else if (ratedValues.length === 1) {
            ratedValues = ratedValues[0]
          } else {
            requestedSchema = {
              type: "array",
              items: requestedSchema,
            }
          }
          bestDescription = {
            schema: requestedSchema,
            schemaId: null,
            value: ratedValues,
            valueId: null,
            widget: description.widget,
            widgetId: description.widgetId,
          }
          break
        }
      }
      // Now that bestDescription is found, lets ensure that it matchs a typed value in database.
      if (bestDescription.valueId === null) {
        if (bestDescription.schemaId === null) {
          let schema = await getOrNewValue(getIdFromSymbol("schema:object"), null, bestDescription.schema)
          bestDescription.schemaId = schema.id
        }
        if (bestDescription.wigetId === null && bestDescription.wiget !== null) {
          let widget = await getOrNewValue(getIdFromSymbol("schema:object"), null, bestDescription.widget)
          bestDescription.widgetId = widget.id
        }
        let value = await getOrNewValue(bestDescription.schemaId, bestDescription.widgetId, bestDescription.value)
        bestDescription.valueId = value.id
      }

      removeAttribute = false
      if (!object.properties) object.properties = {}
      if (object.properties[keyId] != bestDescription.valueId) {
        object.properties[keyId] = bestDescription.valueId
        objectPropertiesChanged = true
      }
    }
  }
  if (removeAttribute) {
    if (object.properties && object.properties[keyId]) {
      delete object.properties[keyId]
      if (Object.keys(object.properties).length === 0) object.properties = null
      objectPropertiesChanged = true
    }
  }

  if (objectPropertiesChanged) {
    await db.none(
      `
        UPDATE objects
        SET properties = $<properties:json>
        WHERE id = $<id>
      `,
      object,
    )
    await generateObjectTextSearch(object)
    await addAction(object.id, "properties")
  }
}


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
  for (let valueId of Object.values(properties)) {
    let typedValue = await getObjectFromId(valueId)
    let schema = (await getObjectFromId(typedValue.schemaId)).value
    if (schema === undefined) {
      console.log("Skipping property value without schema:", typedValue)
      continue
    }
    addReferences(referencedIds, schema, typedValue.value)
  }
  referencedIds.delete(object.id)  // Remove reference to itself.

  let newReferencedIds = new Set(referencedIds)
  let existingReferencedIds = new Set(
    (await db.any("SELECT target_id FROM objects_references WHERE source_id = $1", object.id)).map(
      entry => entry.target_id))
  for (let referencedId of new Set(referencedIds)) {
    if (existingReferencedIds.has(referencedId)) {
      existingReferencedIds.delete(referencedId)
      newReferencedIds.delete(referencedId)
    }
  }
  if (existingReferencedIds.size > 0) {
    await db.none(
      "DELETE FROM objects_references WHERE source_id = $<sourceId> AND target_id in ($<targetIds:csv>)",
      {
        sourceId: object.id,
        targetIds: [...existingReferencedIds],
      },
    )
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
    // await addAction(object.id, "value")  TODO?
  }

  // Compute object usage tags for OGP toolbox tools.
  let referencerIds = new Set(
    (await db.any("SELECT source_id FROM objects_references WHERE target_id = $1", object.id)).map(
      entry => entry.source_id))
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
      [[...referenceIds].sort(), [getIdFromSymbol("use-case")]]
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
    // await addAction(object.id, "value")  TODO?
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
    // await addAction(object.id, "value")  TODO?
  }

  if (object.type === "Value") {
    if (object.schemaId === getIdFromSymbol("schema:localized-string")) {
      // Compute value of a localized-string from its properties.
      let stringIdByLanguageId = {}
      for (let [keyId, valueId] of Object.entries(object.properties || {})) {
        if (localizationKeysId.includes(keyId)) {
          let localizationValue = await getObjectFromId(valueId)
          if (localizationValue.schemaId === getIdFromSymbol("schema:string")) {
            stringIdByLanguageId[keyId] = valueId
          }
        }
      }
      if (!deepEqual(stringIdByLanguageId, object.value)) {
        await db.none("UPDATE values SET value = $<stringIdByLanguageId:json> WHERE id = $<id>", {
          id: object.id,
          stringIdByLanguageId,
        })
        contentChanged = true
        textSearchUpdateNeeded = true
        // await addAction(object.id, "value")  TODO?
      }
    }
  }

  if (object.ratingSum !== undefined) {
    // object is a statement (aka a rated object)
    // Compute statement rating.
    let ratingCount = 0
    let ratingSum = 0
    let ballots = (await db.any(
      "SELECT * FROM ballots WHERE statement_id = $<id>",
      object,
    )).map(entryToBallot)
    for (let ballot of ballots) {
      ratingCount += 1
      if (ballot.rating) ratingSum += ballot.rating
    }
    // TODO: Replace ground arguments with "pros" and "cons" properties.
    // let groundArguments = (await db.any(
    //   "SELECT * FROM statements WHERE (data->>'claimId') = $<id>::text",
    //   object,
    // )).map(entryToStatement)
    // for (let argument of groundArguments) {
    //   if (!argument.isAbuse && (argument.rating || 0) > 0 && ["because", "but"].includes(argument.argumentType)) {
    //     let ground = entryToStatement(await db.oneOrNone(
    //       "SELECT * FROM statements WHERE id = $<groundId>",
    //       argument,
    //     ))
    //     if (!ground.isAbuse && ground.ratingCount) {
    //       ratingCount += ground.ratingCount
    //       ratingSum += (argument.argumentType === "because" ? 1 : -1) * ground.ratingSum
    //     }
    //   }
    // }

    if (object.type === "Card") {
      let keyIds = Object.keys(object.properties || {})
      // When there is at least 5 properties, score is multiplied up by two.
      let ogpToolboxScore = Math.atan(keyIds.length / 5) * 4 / Math.PI
      if (keyIds.includes(getIdFromSymbol("logo"))
        || keyIds.includes(getIdFromSymbol("screenshot"))) {
        ogpToolboxScore *= 10
      }
      let referencesCount = (await db.one(
        "SELECT count(*) AS count FROM objects_references WHERE target_id = $<id>",
        object,
      )).count
      ogpToolboxScore *= Math.max(referencesCount, 0.5)
      // if ((object.subTypeIds || []).includes(getIdFromSymbol("software"))) {}

      ogpToolboxScore = Math.round(ogpToolboxScore)
      ratingCount += ogpToolboxScore
      ratingSum += ogpToolboxScore
    }

    if (ratingCount != object.ratingCount || ratingSum != object.ratingSum) {
      // Save statement rating.
      let rating
      if (ratingCount === 0) {
        Object.assign(object, {
          rating: 0,
          ratingCount: 0,
          ratingSum: 0,
        })
        await db.none(
          `UPDATE statements
            SET rating = DEFAULT, rating_count = DEFAULT, rating_sum = DEFAULT
            WHERE id = $<id>`,
          object,
        )
      } else {
        rating = ratingSum / ratingCount
        Object.assign(object, {
          rating,
          ratingCount,
          ratingSum,
        })
        await db.none(
          `UPDATE statements
            SET rating = $<rating>, rating_count = $<ratingCount>, rating_sum = $<ratingSum>
            WHERE id = $<id>`,
          object,
        )
      }

      // Propagate change of statement rating.
      // TODO: Replace ground arguments with "pros" and "cons" properties: si le statement est mis en value(_id) d'une
      // property de key "pros" ou "cons" (ou d'autres comme advantages & disadvantages), alors il faut recalculer le
      // rating du statement les ayant en pros ou cons.
      // let claimArguments = (await db.any(
      //   `SELECT * FROM statements
      //     WHERE (data->>'groundId') = $<id>::text`,
      //   object,
      // )).map(entryToStatement)
      // for (let argument of claimArguments) {
      //   await addAction(argument.claimId, "rating")
      // }
      if (object.type === "Card") {
        // Nothing to do yet.
      } else if (object.type === "Concept") {
        // Nothing to do yet.
      } else if (object.type === "Property") {
        await handlePropertyChange(object.objectId, object.keyId)
        // If property contains bijective links between 2 cards, also handle the change of the reverse properties.
        let propertyValue = await getObjectFromId(object.valueId)
        assert.ok(propertyValue, `Missing value for ${await describe(object)}`)
        let schema = await getObjectFromId(propertyValue.schemaId)
        assert.ok(schema, `Missing schema for ${await describe(propertyValue)}`)
        if (schema.$ref === "/schemas/bijective-card-reference") {
          let value = propertyValue.value
          await handlePropertyChange(value.targetId, value.reverseKeyId)
        } else if (schema.type === "array") {
          if (Array.isArray(schema.items)) {
            for (let [index, itemSchema] of schema.items.entries()) {
              if (itemSchema.$ref === "/schemas/bijective-card-reference") {
                let itemValue = propertyValue[index]
                await handlePropertyChange(itemValue.targetId, itemValue.reverseKeyId)
              }
            }
          } else if (schema.items.$ref === "/schemas/bijective-card-reference") {
            for (let itemValue of propertyValue) {
              await handlePropertyChange(itemValue.targetId, itemValue.reverseKeyId)
            }
          }
        }
      }

      // Propagate rating change to every reference of object.
      for (let referencedId of referencedIds) {
        addAction(referencedId, action.type)
      }

      // if (object.type === "Abuse") {
      //   let flaggedEntry = await db.oneOrNone(
      //     `SELECT data FROM statements
      //       WHERE id = $<statementId>`,
      //     object,
      //   )
      //   if (flaggedEntry !== null) {
      //     let flaggedData = flaggedEntry.data
      //     let isAbuse = rating !== null && rating > 0
      //     if (isAbuse !== Boolean(flaggedData.isAbuse)) {
      //       if (isAbuse) {
      //         flaggedData.isAbuse = true
      //       } else {
      //         delete flaggedData.isAbuse
      //       }
      //       await db.none(
      //         `UPDATE statements
      //           SET data = $<data>
      //           WHERE id = $<id>`,
      //         flaggedEntry,
      //       )
      //       let claimArguments = (await db.any(
      //         `SELECT * FROM statements
      //           WHERE (data->>'groundId') = $<id>::text`,
      //         flaggedEntry,
      //       )).map(entryToStatement)
      //       for (let argument of claimArguments) {
      //         await addAction(argument.claimId, "rating")
      //       }
      //     }
      //   }
      // } else if (object.type === "Argument") {
      //   await addAction(object.claimId, "rating")
      // } else if (object.type === "Tag") {
      //   let taggedEntry = await db.oneOrNone(
      //       `SELECT * FROM statements
      //         WHERE id = $<statementId>`,
      //       object,
      //     )
      //   if (taggedEntry !== null) {
      //     let taggedData = taggedEntry.data
      //     let addTag = rating !== null && rating > 0
      //     let tagExists = Boolean(taggedData.tags && taggedData.tags.includes(object.name))
      //     if (addTag !== tagExists) {
      //       if (addTag) {
      //         if (!taggedData.tags) taggedData.tags = []
      //         taggedData.tags.push(object.name)
      //         taggedData.tags.sort()
      //       } else {
      //         taggedData.tags.splice(taggedData.tags.indexOf(object.name), 1)
      //       }
      //       if (taggedData.tags.length === 0) delete taggedData.tags
      //       await db.none(
      //         `UPDATE statements
      //           SET data = $<data>
      //           WHERE id = $<id>`,
      //         taggedEntry,
      //       )
      //       await generateObjectTextSearch(entryToStatement(taggedEntry))
      //     }
      //   }
      // }
    }
  }

  if (textSearchUpdateNeeded) {
    await generateObjectTextSearch(object)
  }

  if (contentChanged) {
    // Propagate rating change to every reference of object.
    for (let referencedId of referencedIds) {
      addAction(referencedId, action.type)
    }
  }
}


async function processActions () {
  languageByKeyId = Object.entries(idBySymbol).reduce((d, [symbol, id]) => {
    if (config.languages.includes(symbol)) d[id] = symbol
    return d
  }, {})
  localizationKeysId = Array.from(Object.keys(languageByKeyId))

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


checkDatabase()
  .then(processActions)
  .catch(error => {
    console.log(error.stack || error)
    process.exit(1)
  })
