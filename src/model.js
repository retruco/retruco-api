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


import crypto from "crypto"

import {r} from "./database"


export {addBallotEvent}
async function addBallotEvent(statementId) {
  let events = await r
    .table("events")
    .getAll([statementId, "rating"], {index: "statementIdAndType"})
    .limit(1)
  if (events.length < 1) {
    await r
      .table("events")
      .insert({
        createdAt: r.now(),
        statementId,
        type: "rating",
      })
  }
}


export function hashStatement(statement) {
  // Two statements have the same hash if and only if the statements have exactly the same content (except ID, dates,
  // etc).
  const hash = crypto.createHash('sha256')
  hash.update(statement.type)
  if (statement.type === "Abuse") {
    hash.update(statement.statementId)
  } else if (statement.type === "Argument") {
    hash.update(statement.claimId)
    hash.update(statement.groundId)
  } else if (statement.type === "Card") {
    // TODO: Hash what?
  } else if (statement.type === "PlainStatement") {
    hash.update(statement.languageCode)
    hash.update(statement.name)
  } else if (statement.type === "Property") {
    hash.update(statement.statementId)
    // hash.update(statement.languageCode)
    hash.update(statement.name)
    hash.update(JSON.stringify(statement.schema))
    hash.update(JSON.stringify(statement.widget))
    hash.update(JSON.stringify(statement.value))
  } else if (statement.type === "Tag") {
    hash.update(statement.statementId)
    hash.update(statement.name)
  }
  statement.hash = hash.digest('base64')
}


export function ownsUser(user, otherUser) {
  if (!user) return false
  if (user.isAdmin) return true
  return user.id === otherUser.id
}


export {rateStatement}
async function rateStatement(statementId, userId, rating) {
  let id = [statementId, userId].join("/")
  let oldBallot = await r
    .table("ballots")
    .get(id)
  let ballot
  if (oldBallot === null) {
    ballot = {
      id,
      rating: rating,
      statementId: statementId,
      updatedAt: r.now(),
      voterId: userId,
    }
    let result = await r
      .table("ballots")
      .insert(ballot, {returnChanges: true})
    ballot = result.changes[0].new_val
    await addBallotEvent(statementId)
  } else if (rating !== oldBallot.rating) {
    ballot = {...oldBallot}
    ballot.rating = rating
    ballot.updatedAt = r.now()
    let result = await r
      .table("ballots")
      .get(id)
      .update(ballot, {returnChanges: true})
    ballot = result.changes[0].new_val
    await addBallotEvent(statementId)
  } else {
    ballot = oldBallot
  }
  return [oldBallot, ballot]
}


export {toBallotData}
async function toBallotData(ballot, statements, user, {depth = 0, showAbuse = false, showAuthor = false,
  showBallot = false, showGrounds = false, showProperties = false, showTags = false} = {}) {
  let data = {
    ballots: {[ballot.id]: toBallotJson(ballot)},
    id: ballot.id,
    statements: {},
    users: {},
  }
  let statementsCache = {}
  for (let statement of statements) {
    statementsCache[statement.id] = statement
  }

  for (let statement of statements) {
    await toStatementData1(data, statement, statementsCache, user,
      {depth, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
  }

  if (Object.keys(data.ballots).length === 0) delete data.ballots
  if (Object.keys(data.statements).length === 0) delete data.statements
  if (Object.keys(data.users).length === 0) delete data.users
  return data
}


function toBallotJson(ballot) {
  let ballotJson = {...ballot}
  if (ballotJson.updatedAt) ballotJson.updatedAt = ballotJson.updatedAt.toISOString()
  return ballotJson
}


export {toStatementData}
async function toStatementData(statement, user, {depth = 0, showAbuse = false, showAuthor = false, showBallot = false,
  showGrounds = false, showProperties = false, showTags = false} = {}) {
  let data = {
    ballots: {},
    id: statement.id,
    statements: {},
    users: {},
  }
  let statementsCache = {}

  await toStatementData1(data, statement, statementsCache, user,
    {depth, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})

  if (Object.keys(data.ballots).length === 0) delete data.ballots
  if (Object.keys(data.statements).length === 0) delete data.statements
  if (Object.keys(data.users).length === 0) delete data.users
  return data
}


async function toStatementData1(data, statement, statementsCache, user, {depth = 0, showAbuse = false,
  showAuthor = false, showBallot = false, showGrounds = false, showProperties = false, showTags = false} = {}) {
  let statementJsonById = data.statements
  if (statementJsonById[statement.id]) return

  const cachedStatement = statementsCache[statement.id]
  if (cachedStatement) statement = cachedStatement

  const statementJson = toStatementJson(statement)
  statementJsonById[statement.id] = statementJson

  if (statement.type === "Abuse") {
    if (statement.statementId) {
      const flaggedStatement = await r
        .table("statements")
        .get(statement.statementId)
      await toStatementData1(data, flaggedStatement, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
  } else if (statement.type === "Argument") {
    if (statement.claimId) {
      const claim = await r
        .table("statements")
        .get(statement.claimId)
      await toStatementData1(data, claim, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
    if (statement.groundId) {
      const ground = await r
        .table("statements")
        .get(statement.groundId)
      await toStatementData1(data, ground, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
  } else if (statement.type === "Property") {
    if (statement.statementId) {
      const statementWithProperties = await r
        .table("statements")
        .get(statement.statementId)
      await toStatementData1(data, statementWithProperties, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
  } else if (statement.type === "Tag") {
    if (statement.statementId) {
      const taggedStatement = await r
        .table("statements")
        .get(statement.statementId)
      await toStatementData1(data, taggedStatement, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
  }

  if (showAbuse) {
    const abuses = await r
      .table("statements")
      .getAll([statement.id, "Abuse"], {index: "statementIdAndType"})
    const abuse = abuses.length > 0 ? abuses[0] : null
    statementJson.abuseId = abuse !== null ? abuse.id : null
    if (depth > 0 && abuse !== null) {
      await toStatementData1(data, abuse, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
  }
  if (showGrounds) {
    const groundArguments = await r
      .table("statements")
      .getAll(statement.id, {index: "claimId"})
    statementJson.groundIds = groundArguments.map(groundArgument => groundArgument.id)
    if (depth > 0) {
      for (let groundArgument of groundArguments) {
        await toStatementData1(data, groundArgument, statementsCache, user,
          {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
      }
      const groundStatements = await r
        .table("statements")
        .getAll(...groundArguments.map(groundArgument => groundArgument.groundId))
      for (let groundStatement of groundStatements) {
        await toStatementData1(data, groundStatement, statementsCache, user,
          {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
      }
    }
  }
  if (showProperties) {
    const properties = await r
      .table("statements")
      .getAll([statement.id, "Property"], {index: "statementIdAndType"})
    let activePropertiesIds = statement.activePropertiesIds || []
    let ballotJsonById = data.ballots
    let userPropertiesIds = []
    for (let property of properties) {
      if (user) {
        let ballotId = [property.id, user.id].join("/")
        let ballot = ballotJsonById[ballotId]
        if (!ballot) {
          ballot = await r
            .table("ballots")
            .get(ballotId)
          if (ballot !== null && showBallot) ballotJsonById[ballotId] = toBallotJson(ballot)
        }
        if (ballot !== null) userPropertiesIds.push(property.id)
      }
      if (depth > 0 && (activePropertiesIds.includes(property.id) || userPropertiesIds.includes(property.id))) {
        await toStatementData1(data, property, statementsCache, user,
          {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
      }
    }
    if (userPropertiesIds.length > 0) statement.userPropertiesIds = userPropertiesIds
  }
  if (showTags) {
    const tags = await r
      .table("statements")
      .getAll([statement.id, "Tag"], {index: "statementIdAndType"})
    statementJson.tagIds = tags.map(tag => tag.id)
    if (depth > 0) {
      for (let tag of tags) {
        await toStatementData1(data, tag, statementsCache, user,
          {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
      }
    }
  }

  if (showAuthor && statement.authorId){
    let userJsonById = data.users
    if (!userJsonById[statement.authorId]) {
      let user = await r
        .table("users")
        .get(statement.authorId)
      if (user !== null) userJsonById[statement.authorId] = toUserJson(user)
    }
  }

  if (showBallot && user) {
    let ballotJsonById = data.ballots
    let ballotId = [statement.id, user.id].join("/")
    statementJson.ballotId = ballotId
    if (!ballotJsonById[ballotId]) {
      let ballot = await r
        .table("ballots")
        .get(ballotId)
      if (ballot !== null) ballotJsonById[ballotId] = toBallotJson(ballot)
    }
  }
}


function toStatementJson(statement) {
  let statementJson = {...statement}
  statementJson.createdAt = statementJson.createdAt.toISOString()
  delete statementJson.hash
  return statementJson
}


export {toStatementsData}
async function toStatementsData(statements, user, {depth = 0, showAbuse = false, showAuthor = false, showBallot = false,
  showGrounds = false, showProperties = false, showTags = false} = {}) {
  let data = {
    ballots: {},
    ids: statements.map(statement => statement.id),
    statements: {},
    users: {},
  }
  let statementsCache = {}
  for (let statement of statements) {
    statementsCache[statement.id] = statement
  }

  for (let statement of statements) {
    await toStatementData1(data, statement, statementsCache, user,
      {depth, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
  }

  if (Object.keys(data.ballots).length === 0) delete data.ballots
  if (Object.keys(data.statements).length === 0) delete data.statements
  if (Object.keys(data.users).length === 0) delete data.users
  return data
}


export {toUserJson}
function toUserJson(user, {showApiKey = false, showEmail = false} = {}) {
  let userJson = {...user}
  if (!showApiKey) delete userJson.apiKey
  if (!showEmail) delete userJson.email
  userJson.createdAt = userJson.createdAt.toISOString()
  // delete userJson.id
  delete userJson.passwordDigest
  delete userJson.salt
  return userJson
}


export {unrateStatement}
async function unrateStatement(statementId, userId) {
  let id = [statementId, userId].join("/")
  let oldBallot = await r
    .table("ballots")
    .get(id)
  if (oldBallot !== null) {
    await r
      .table("ballots")
      .get(id)
      .delete()
    await addBallotEvent(statementId)
  }
  return oldBallot
}


export const wrapAsyncMiddleware = fn => (...args) => fn(...args).catch(args[2])
