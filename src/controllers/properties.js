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


import {getObjectFromId, getOrNewProperty, toDataJson, wrapAsyncMiddleware} from "../model"
import {getIdFromIdOrSymbol} from "../symbols"


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
      errors["objectId"] =  `No object with symbol "${propertyInfos.objectId}".`
    } else {
      object = await getObjectFromId(objectId)
      if (object === null) {
        errors["objectId"] =  `No object with ID or symbol "${propertyInfos.objectId}".`
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
      errors["keyId"] =  `No object with symbol "${propertyInfos.keyId}".`
    } else {
      typedKey = await getObjectFromId(keyId)
      if (typedKey === null) {
        errors["keyId"] =  `No object with ID or symbol "${propertyInfos.keyId}".`
      } else if (typedKey.type !== "Value") {
        errors["valueId"] =  `Object "${propertyInfos.keyId}" is not a Value but a ${typedKey.type}.`
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
      errors["valueId"] =  `No object with symbol "${propertyInfos.valueId}".`
    } else {
      typedValue = await getObjectFromId(valueId)
      if (typedValue === null) {
        errors["valueId"] =  `No object with ID or symbol "${propertyInfos.valueId}".`
      } else if (typedValue.type !== "Value") {
        errors["valueId"] =  `Object "${propertyInfos.valueId}" is not a Value but a ${typedValue.type}.`
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400,  // Bad Request
      errors,
      message: "Errors detected in schema and/or widget definitions.",
    })
    return
  }

  let propertyOrProperties = await getOrNewProperty(object.id, typedKey.id, typedValue.id, {userId})

  res.status(201)  // Created
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
