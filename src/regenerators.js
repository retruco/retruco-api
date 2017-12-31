// Retruco-API -- HTTP API to bring out shared positions from argumented statements
// By: Paula Forteza <paula@retruco.org>
//     Emmanuel Raviart <emmanuel@retruco.org>
//
// Copyright (C) 2016, 2017 Paula Forteza & Emmanuel Raviart
// https://framagit.org/retruco/retruco-api
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

import { db } from "./database"
import { addAction, generateObjectTextSearch, getObjectFromId } from "./model"

export async function regenerateActions(types, actionType) {
  let whereClause = types.length === 0 ? "" : "WHERE type IN ($<types:csv>)"
  let ids = (await db.any(
    `
      SELECT id
      FROM objects
      ${whereClause}
    `,
    {
      types,
    },
  )).map(object => object.id)
  for (let id of ids) {
    await addAction(id, actionType)
  }
}

export async function regenerateArguments(statementId, debateKeyIds) {
  let object = await getObjectFromId(statementId)
  assert.ok(object, `Missing objet at ID ${statementId}`)
  if (object.ratingSum === undefined) {
    // object is not a statement (aka not a rated object) => It has no argumentation.
    return
  }

  // Retrieve all the argumentation-related valid properties of the rated object, sorting by decreasing rating and id.

  let entry = await db.one(
    `
      SELECT count(properties.id) AS argument_count
      FROM statements
      INNER JOIN properties ON statements.id = properties.id
      WHERE properties.object_id = $<statementId>
      AND properties.key_id IN ($<debateKeyIds:csv>)
      AND NOT statements.trashed
      AND statements.rating_sum > 0
    `,
    {
      debateKeyIds,
      statementId,
    },
  )
  let argumentCount = entry.argument_count
  let argumentCountChanged = argumentCount !== object.argumentCount
  if (argumentCountChanged) object.argumentCount = argumentCount

  if (argumentCountChanged) {
    await db.none(
      `
        UPDATE statements
        SET argument_count = $<argumentCount>
        WHERE id = $<id>
      `,
      object,
    )
  }
  return argumentCountChanged
}

export async function regenerateQualities(objectId, keyId) {
  let object = await getObjectFromId(objectId)
  assert.ok(object, `Missing objet at ID ${objectId}`)

  // Retrieve all the valid properties of the given object having the given key.
  let valueIds = (await db.any(
    `
      SELECT values.id as value_id
      FROM objects
      INNER JOIN statements ON objects.id = statements.id
      INNER JOIN properties ON statements.id = properties.id
      INNER JOIN values ON properties.value_id = values.id
      INNER JOIN values AS schemas ON values.schema_id = schemas.id
      LEFT JOIN values AS widgets ON values.widget_id = widgets.id
      WHERE properties.object_id = $<objectId>
      AND properties.key_id = $<keyId>
      AND NOT statements.trashed
      AND statements.rating_sum > 0
      ORDER BY statements.rating_sum DESC, objects.id DESC
    `,
    {
      keyId,
      objectId,
    },
  )).map(entry => entry.value_id)

  // Remove duplicate value IDs. (This should not occur, but...)
  let uniqueValueIds = []
  for (let valueId of valueIds) {
    if (!uniqueValueIds.includes(valueId)) {
      uniqueValueIds.push(valueId)
    }
  }

  let objectQualitiesChanged = false
  if (uniqueValueIds.length > 0) {
    if (!object.qualities) object.qualities = {}
    if (uniqueValueIds.length === 1) uniqueValueIds = uniqueValueIds[0]
    if (!deepEqual(object.qualities[keyId], uniqueValueIds)) {
      object.qualities[keyId] = uniqueValueIds
      objectQualitiesChanged = true
    }
  } else if (object.qualities && object.qualities[keyId]) {
    delete object.qualities[keyId]
    if (Object.keys(object.qualities).length === 0) object.qualities = null
    objectQualitiesChanged = true
  }

  if (objectQualitiesChanged) {
    await db.none(
      `
        UPDATE objects
        SET qualities = $<qualities:json>
        WHERE id = $<id>
      `,
      object,
    )
    await generateObjectTextSearch(object)
    await addAction(object.id, "update")
  }
  return objectQualitiesChanged
}
