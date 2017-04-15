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

import { db } from "../database"
import {
  entryToValue,
  getObjectFromId,
  getOrNewProperty,
  toDataJson,
  toObjectJson,
  wrapAsyncMiddleware,
} from "../model"
import { getIdFromIdOrSymbol } from "../symbols"

export const autocompletePropertiesKeys = wrapAsyncMiddleware(async function autocompletePropertiesKeys(req, res) {
  let language = req.query.language
  let limit = req.query.limit || 20
  let objectType = req.query.class || []
  let subTypes = req.query.type || []
  let subTypeIds = subTypes.map(getIdFromIdOrSymbol).filter(subTypeId => subTypeId)
  let tags = req.query.tag || []
  let tagIds = tags.map(getIdFromIdOrSymbol).filter(tag => tag)
  let term = req.query.term

  let whereClauses = ["parent_objects.type = $<objectType>"]

  if (language) {
    whereClauses.push("language = $<language>")
  }

  if (subTypeIds.length > 0) {
    whereClauses.push("parent_objects.sub_types && $<subTypeIds>")
  }

  if (tagIds.length > 0) {
    whereClauses.push("parent_objects.tags @> $<tagIds>")
  }

  let whereClause = whereClauses.length === 0 ? "" : "WHERE " + whereClauses.join(" AND ")

  let entries = await db.any(
    `
      SELECT objects.*, values.*, values_autocomplete.autocomplete,
        values_autocomplete.autocomplete <-> $<term> AS distance
      FROM properties
      INNER JOIN objects ON properties.key_id = objects.id
      INNER JOIN values ON objects.id = values.id
      INNER JOIN values_autocomplete ON values.id = values_autocomplete.id
      INNER JOIN objects AS parent_objects ON properties.object_id = parent_objects.id
      ${whereClause}
      GROUP BY objects.id, values.id, values_autocomplete.autocomplete
      ORDER BY distance ASC, count(objects.id) DESC
      LIMIT $<limit>
    `,
    {
      language,
      limit,
      objectType,
      subTypeIds,
      tagIds,
      term: term || "",
    },
  )

  let autocompletions = []
  for (let entry of entries) {
    let autocomplete = entry.autocomplete
    delete entry.autocomplete
    let distance = entry.distance
    delete entry.distance
    autocompletions.push({
      autocomplete,
      distance,
      value: await toObjectJson(await entryToValue(entry)),
    })
  }

  res.json({
    apiVersion: "1",
    data: autocompletions,
  })
})

export const createProperty = wrapAsyncMiddleware(async function createProperty(req, res) {
  // Create a new card, giving its initial attributes, schemas & widgets.
  let authenticatedUser = req.authenticatedUser
  let propertyInfos = req.body
  let show = req.query.show || []
  let userId = authenticatedUser.id

  let errors = {}

  let object = null
  let objectId = propertyInfos.objectId
  if (!objectId) {
    errors["objectId"] = "Missing value."
  } else {
    objectId = getIdFromIdOrSymbol(objectId)
    if (!objectId) {
      errors["objectId"] = `No object with symbol "${propertyInfos.objectId}".`
    } else {
      object = await getObjectFromId(objectId)
      if (object === null) {
        errors["objectId"] = `No object with ID or symbol "${propertyInfos.objectId}".`
      }
    }
  }

  let keyId = propertyInfos.keyId
  let typedKey = null
  if (!keyId) {
    errors["keyId"] = "Missing value."
  } else {
    keyId = getIdFromIdOrSymbol(keyId)
    if (!keyId) {
      errors["keyId"] = `No object with symbol "${propertyInfos.keyId}".`
    } else {
      typedKey = await getObjectFromId(keyId)
      if (typedKey === null) {
        errors["keyId"] = `No object with ID or symbol "${propertyInfos.keyId}".`
      } else if (typedKey.type !== "Value") {
        errors["valueId"] = `Object "${propertyInfos.keyId}" is not a Value but a ${typedKey.type}.`
      }
    }
  }

  let typedValue = null
  let valueId = propertyInfos.valueId
  if (!valueId) {
    errors["valueId"] = "Missing value."
  } else {
    valueId = getIdFromIdOrSymbol(valueId)
    if (!valueId) {
      errors["valueId"] = `No object with symbol "${propertyInfos.valueId}".`
    } else {
      typedValue = await getObjectFromId(valueId)
      if (typedValue === null) {
        errors["valueId"] = `No object with ID or symbol "${propertyInfos.valueId}".`
      } else if (typedValue.type !== "Value") {
        errors["valueId"] = `Object "${propertyInfos.valueId}" is not a Value but a ${typedValue.type}.`
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400, // Bad Request
      errors,
      message: "Errors detected in schema and/or widget definitions.",
    })
    return
  }

  let propertyOrProperties = await getOrNewProperty(object.id, typedKey.id, typedValue.id, { userId })

  res.status(201) // Created
  res.json({
    apiVersion: "1",
    data: await toDataJson(propertyOrProperties, authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  })
})
