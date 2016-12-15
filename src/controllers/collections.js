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

import {db} from "../database"
import {getObjectFromId, ownsUserId, toDataJson1, wrapAsyncMiddleware} from "../model"


export const createCollection = wrapAsyncMiddleware(async function createCollection(req, res) {
  let authenticatedUser = req.authenticatedUser
  let collectionInfos = req.body
  let show = req.query.show || []
  let userId = authenticatedUser.id

  let collection = collectionInfos
  collection.authorId = userId

  let cardIds = []
  for (let cardId of collection.cardIds || []) {
    cardId = Number(cardId)
    if (Number.isNaN(cardId)) continue
    let card = await getObjectFromId(String(cardId))
    if (card === null) continue
    cardIds.push(cardId)
  }
  collection.cardIds = cardIds.length === 0 ? null : cardIds

  let entry = await db.one(
    `
      INSERT INTO collections(author, cards, created_at, description, logo, name)
      VALUES ($<authorId>, $<cardIds>, current_timestamp, $<description>, $<logo>, $<name>)
      RETURNING created_at, id
    `,
    collection,
  )
  collection.createdAt = entry.created_at
  collection.id = entry.id

  res.status(201)  // Created
  res.json({
    apiVersion: "1",
    data: await toCollectionData(collection, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  })
})


export const deleteCollection = wrapAsyncMiddleware(async function deleteCollection(req, res) {
  let authenticatedUser = req.authenticatedUser
  let show = req.query.show || []
  let collection = req.collection

  if (!ownsUserId(authenticatedUser, collection.authorId)) {
    res.status(403)  // Forbidden
    res.json({
      apiVersion: "1",
      code: 403,  // Forbidden
      message: "A collection can only be deleted by its author or an admin.",
    })
    return
  }

  await db.none("DELETE FROM collections WHERE id = $<id>", collection)

  res.json({
    apiVersion: "1",
    data: await toCollectionData(collection, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  })
})


export const editCollection = wrapAsyncMiddleware(async function editCollection(req, res) {
  let authenticatedUser = req.authenticatedUser
  let show = req.query.show || []
  let collection = req.collection
  let collectionInfos = req.body

  if (!ownsUserId(authenticatedUser, collection.authorId)) {
    res.status(403)  // Forbidden
    res.json({
      apiVersion: "1",
      code: 403,  // Forbidden
      message: "A collection can only be edited by its author or an admin.",
    })
    return
  }

  let cardIds = []
  for (let cardId of collectionInfos.cardIds || []) {
    cardId = Number(cardId)
    if (Number.isNaN(cardId)) continue
    let card = await getObjectFromId(String(cardId))
    if (card === null) continue
    cardIds.push(cardId)
  }
  collection.cardIds = cardIds.length === 0 ? null : cardIds

  collection.description = collectionInfos.description
  collection.logo = collectionInfos.logo
  collection.name = collectionInfos.name
  await db.none(
    `
      UPDATE collections
      SET cards = $<cardIds>, description = $<description>, logo = $<logo>, name = $<name>
      WHERE id = $<id>
    `,
    collection,
  )

  res.json({
    apiVersion: "1",
    data: await toCollectionData(collection, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  })
})


function entryToCollection(entry) {
  return entry === null ? null : {
    authorId: entry.author,
    cardIds: entry.cards,
    createdAt: entry.created_at,
    description: entry.description,
    id: entry.id,
    logo: entry.logo,
    name: entry.name,
  }
}


export const getCollection = wrapAsyncMiddleware(async function getCollection(req, res) {
  let collection = req.collection || []
  let show = req.query.show || []
  res.json({
    apiVersion: "1",
    data: await toCollectionData(collection, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  })
})


export const listCollections = wrapAsyncMiddleware(async function listCollections(req, res) {
  let limit = req.query.limit || 20
  let offset = req.query.offset || 0
  let show = req.query.show || []
  let authenticatedUser = req.authenticatedUser

  let coreArguments = {}
  let count = Number((await db.one(
    `
      SELECT count(*) as count
      FROM collections
    `,
    coreArguments,
  )).count)

  let collections = (await db.any(
    `
      SELECT * FROM collections
      ORDER BY id
      LIMIT $<limit>
      OFFSET $<offset>
    `,
    Object.assign({}, coreArguments, {
      limit,
      offset,
    }),
  )).map(entryToCollection)

  res.json({
    apiVersion: "1",
    count: count,
    data: await toCollectionData(collections, authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
    limit: limit,
    offset: offset,
  })
})


export const listUserCollections = wrapAsyncMiddleware(async function listUserCollections(req, res) {
  let limit = req.query.limit || 20
  let offset = req.query.offset || 0
  let show = req.query.show || []
  let user = req.user
  let authenticatedUser = req.authenticatedUser

  let coreArguments = {
    authorId: user.id,
  }
  let count = Number((await db.one(
    `
      SELECT count(*) as count
      FROM collections
      WHERE author = $<authorId>
    `,
    coreArguments,
  )).count)

  let collections = (await db.any(
    `
      SELECT * FROM collections WHERE author = $<authorId>
      ORDER BY id
      LIMIT $<limit>
      OFFSET $<offset>
    `,
    Object.assign({}, coreArguments, {
      limit,
      offset,
    }),
  )).map(entryToCollection)

  res.json({
    apiVersion: "1",
    count: count,
    data: await toCollectionData(collections, authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
    limit: limit,
    offset: offset,
  })
})


export const requireCollection = wrapAsyncMiddleware(async function requireCollection(req, res, next) {
  let id = req.params.id

  let collection = entryToCollection(await db.oneOrNone("SELECT * FROM collections WHERE id = $1", id))
  if (collection === null) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No collection with ID "${id}".`,
    })
    return
  }
  req.collection = collection

  return next()
})


export {toCollectionData}
async function toCollectionData(collectionOrCollections, user, {
  depth = 0,
  objectsCache = null,
  showBallots = false,
  showProperties = false,
  showReferences = false,
  showValues = false,
} = {}) {
  let collectionJsonById = {}
  let collections = Array.isArray(collectionOrCollections) ? collectionOrCollections : [collectionOrCollections]
  let objectIds = new Set()
  for (let collection of collections) {
    collectionJsonById[collection.id] = toCollectionJson(collection)
    assert.ok(collection.authorId)
    objectIds.add(collection.authorId)
    for (let cardId of collection.cardIds || []) {
      objectIds.add(cardId)
    }
  }

  objectsCache = objectsCache ? Object.assign({}, objectsCache) : {}
  let data = {
    ballots: {},
    cards: {},
    collections: collectionJsonById,
    concepts: {},
    properties: {},
    users: {},
    values: {},
    visitedIds: new Set(),
  }
  if (Array.isArray(collectionOrCollections)) {
    data.ids = Object.keys(collectionJsonById)
  } else {
    data.id = collectionOrCollections.id
  }

  for (let objectId of objectIds) {
    await toDataJson1(objectId, data, objectsCache, user, {depth, showBallots, showProperties, showReferences,
      showValues})
  }

  if (Object.keys(data.ballots).length === 0) delete data.ballots
  if (Object.keys(data.cards).length === 0) delete data.cards
  if (Object.keys(data.collections).length === 0) delete data.collections
  if (Object.keys(data.concepts).length === 0) delete data.concepts
  if (Object.keys(data.properties).length === 0) delete data.properties
  if (Object.keys(data.users).length === 0) delete data.users
  if (Object.keys(data.values).length === 0) delete data.values
  delete data.visitedIds
  return data
}


function toCollectionJson(collection) {
  let collectionJson = Object.assign({}, collection)
  if (collectionJson.createddAt) collectionJson.createddAt = collectionJson.createddAt.toISOString()
  return collectionJson
}
