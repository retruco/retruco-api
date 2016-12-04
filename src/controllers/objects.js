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


import {db} from "../database"
import {entryToProperty, getObjectFromId, toDataJson, toObjectJson, wrapAsyncMiddleware} from "../model"
import {getIdFromIdOrSymbol, getIdOrSymbolFromId} from "../symbols"


export const getObject = wrapAsyncMiddleware(async function getObject(req, res) {
  let show = req.query.show || []
  res.json({
    apiVersion: "1",
    data: await toDataJson(req.object, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  })
})


export const listObjectSameKeyProperties = wrapAsyncMiddleware(async function listObjectSameKeyProperties(req, res) {
  let objectId = req.object.id
  let show = req.query.show || []

  let keyId = getIdFromIdOrSymbol(req.params.keyIdOrSymbol)
  if (!keyId) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No object with symbol "${req.params.keyIdOrSymbol}".`,
    })
    return
  }
  let typedKey = await getObjectFromId(keyId)
  if (typedKey === null) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No object with ID or symbol "${req.params.keyIdOrSymbol}".`,
    })
    return
  }

  let sameKeyProperties = (await db.any(
    `
      SELECT objects.*, statements.*, properties.*, symbol
      FROM objects
      INNER JOIN statements ON objects.id = statements.id
      INNER JOIN properties ON statements.id = properties.id
      LEFT JOIN symbols ON properties.id = symbols.id
      WHERE properties.object_id = $<objectId>
      AND properties.key_id = $<keyId>
      ORDER BY rating DESC, created_at DESC
    `,
    {
      keyId,
      objectId,
    },
  )).map(entryToProperty)

  res.json({
    apiVersion: "1",
    data: await toDataJson(sameKeyProperties, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  })
})


export const nextProperties = wrapAsyncMiddleware(async function nextProperties(req, res) {
  let object = req.object
  let keysOrder = null
  for (let subTypeId of object.subTypeIds || []) {
    keysOrder = (await db.oneOrNone(
      `
        SELECT keys_order FROM types
        WHERE id = $1
      `,
      subTypeId,
    )).keys_order
    if (keysOrder !== null) break
  }
  let nextKeysOrder = null
  if (keysOrder === null) {
    nextKeysOrder = []
  } else {
    let latestPropertyKeyIds = (await db.any(
      `
        SELECT key_id FROM properties
        WHERE object_id = $<id>
        ORDER BY id DESC
      `,
      object,
    )).map(entry => entry.key_id)
    for (let keyId of latestPropertyKeyIds) {
      let keyIdIndex = keysOrder.indexOf(keyId)
      if (keyIdIndex >= 0) {
        nextKeysOrder = keysOrder.slice(keyIdIndex + 1).filter(id => !latestPropertyKeyIds.includes(id))
        if (nextKeysOrder.length > 0) break
      }
    }
    if (nextKeysOrder === null) {
      // No key from keysOrder has been used yet. Take them all.
      nextKeysOrder = keysOrder.filter(id => !latestPropertyKeyIds.includes(id))
    }
  }

  let order = []
  let valueByIdOrSymbol = {}
  for (let keyId of nextKeysOrder) {
    let keyIdOrSymbol = getIdOrSymbolFromId(keyId)
    if (valueByIdOrSymbol[keyIdOrSymbol] === undefined) {
      valueByIdOrSymbol[keyIdOrSymbol] = await toObjectJson(await getObjectFromId(keyId))
    }
    let keySchemasWidgetsOrder = (await db.oneOrNone(
      `
        SELECT schemas_widgets_order FROM keys
        WHERE id = $1
      `,
      keyId,
    )).schemas_widgets_order || []
    let keyOrder = []
    for (let [schemaId, widgetIds] of keySchemasWidgetsOrder) {
      let schemaIdOrSymbol = getIdOrSymbolFromId(schemaId)
      if (valueByIdOrSymbol[schemaIdOrSymbol] === undefined) {
        valueByIdOrSymbol[schemaIdOrSymbol] = await toObjectJson(await getObjectFromId(schemaId))
      }
      let widgetsOrder = []
      for (let widgetId of widgetIds) {
        let widgetIdOrSymbolFromId = getIdOrSymbolFromId(widgetId)
        if (valueByIdOrSymbol[widgetIdOrSymbolFromId] === undefined) {
          valueByIdOrSymbol[widgetIdOrSymbolFromId] = await toObjectJson(await getObjectFromId(widgetId))
        }
        widgetsOrder.push(widgetIdOrSymbolFromId)
      }
      keyOrder.push([schemaIdOrSymbol, widgetsOrder])
    }
    order.push([keyIdOrSymbol, keyOrder])
  }

  res.json({
    apiVersion: "1",
    data: {
      order,
      values: valueByIdOrSymbol,
    },
  })
})


export const requireObject = wrapAsyncMiddleware(async function requireObject(req, res, next) {
  let id = getIdFromIdOrSymbol(req.params.idOrSymbol)
  if (!id) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No object with symbol "${req.params.idOrSymbol}".`,
    })
    return
  }
  let object = await getObjectFromId(id)
  if (object === null) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No object with ID or symbol "${req.params.idOrSymbol}".`,
    })
    return
  }
  req.object = object

  return next()
})
