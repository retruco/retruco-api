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


import {db, entryToAction, entryToBallot, entryToStatement, entryToUser} from "./database"


export {addBallotAction}
async function addBallotAction(statementId) {
  let action = {
    statementId,
    type: "rating",
  }
  let existingAction = entryToAction(await db.oneOrNone(
    `SELECT * FROM actions
      WHERE statement_id = $<statementId> AND type = 'rating'
      LIMIT 1`,
    action,
  ))
  if (existingAction !== null) return existingAction
  let result = await db.one(
    `INSERT INTO actions(created_at, statement_id, type)
      VALUES (current_timestamp, $<statementId>, $<type>)
      RETURNING created_at, id`,
    action,
  )
  action.createdAt = result.created_at
  action.id = result.id
  return action
}


export function ownsUser(user, otherUser) {
  if (!user) return false
  if (user.isAdmin) return true
  return user.id === otherUser.id
}


export {propagateOptimisticOptimization}
async function propagateOptimisticOptimization(statements, statement, oldRating, oldRatingSum) {
  const newRatingCount = statement.ratingCount !== undefined ? statement.ratingCount : 0
  const newRating = newRatingCount > 0 ? statement.rating : 0
  const newRatingSum = newRatingCount > 0 ? statement.ratingSum : 0
  if (oldRating === undefined) oldRating = 0
  if (oldRatingSum === undefined) oldRatingSum = 0

  if (statement.type === "Abuse") {
    if (oldRatingSum <= 0 && newRatingSum > 0 || oldRatingSum > 0 && newRatingSum <= 0) {
      let flaggedStatement = entryToStatement(await db.oneOrNone(
          `SELECT * FROM statements
            WHERE id = $<statementId>`,
          statement,
        ))
      if (flaggedStatement !== null) {
        if (newRatingSum > 0) flaggedStatement.isAbuse = true
        else delete flaggedStatement.isAbuse
        statements.push(flaggedStatement)
      }
    }
  } else if (statement.type === "Argument") {
    if (!statement.isAbuse && ["because", "but"].includes(statement.argumentType)) {
      if ((oldRating > 0) !== (newRating > 0)) {
        let claim = entryToStatement(await db.oneOrNone(
          `SELECT * FROM statements
            WHERE id = $<claimId>`,
          statement,
        ))
        let ground = entryToStatement(await db.oneOrNone(
          `SELECT * FROM statements
            WHERE id = $<groundId>`,
          statement,
        ))
        if (claim !== null && claim.ratingCount && ground !== null && !ground.isAbuse) {
          claim.ratingSum = (claim.ratingSum || 0) +
            ((newRating > 0) - (oldRating > 0)) * (statement.argumentType === "because" ? 1 : -1)
            * (ground.ratingSum || 0)
          claim.ratingSum = Math.max(-claim.ratingCount, Math.min(claim.ratingCount, claim.ratingSum))
          claim.rating = claim.ratingSum / claim.ratingCount
          statements.push(claim)
        }
      }
    }
  }
}


export {rateStatement}
async function rateStatement(statementId, voterId, rating) {
  let ballot = {
    id: `${statementId}/${voterId}`,
    rating,
    statementId,
    voterId,
  }
  let oldBallot = entryToBallot(await db.oneOrNone(
    "SELECT * FROM ballots WHERE statement_id = $<statementId> AND voter_id = $<voterId>",
    ballot,
  ))
  if (oldBallot === null) {
    let result = await db.one(
      `INSERT INTO ballots(rating, statement_id, updated_at, voter_id)
        VALUES ($<rating>, $<statementId>, current_timestamp, $<voterId>)
        RETURNING updated_at`,
      ballot,
    )
    ballot.updatedAt = result.updated_at
    await addBallotAction(statementId)
  } else if (rating !== oldBallot.rating) {
    let result = await db.one(
      `UPDATE ballots
        SET rating = $<rating>, updated_at = current_timestamp
        WHERE statement_id = $<statementId> AND voter_id = $<voterId>
        RETURNING updated_at`,
      ballot,
    )
    ballot.updatedAt = result.updated_at
    await addBallotAction(statementId)
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
  showGrounds = false, showProperties = false, showTags = false, statements = []} = {}) {
  let data = {
    ballots: {},
    id: statement.id,
    statements: {},
    users: {},
  }
  let statementsCache = {}
  for (let statement of statements) {
    statementsCache[statement.id] = statement
  }

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
      const flaggedStatement = entryToStatement(await db.oneOrNone(
        `SELECT * FROM statements
          WHERE id = $<statementId>`,
        statement,
      ))
      await toStatementData1(data, flaggedStatement, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
  } else if (statement.type === "Argument") {
    if (statement.claimId) {
      const claim = entryToStatement(await db.oneOrNone(
        `SELECT * FROM statements
          WHERE id = $<claimId>`,
        statement,
      ))
      await toStatementData1(data, claim, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
    if (statement.groundId) {
      const ground = entryToStatement(await db.oneOrNone(
        `SELECT * FROM statements
          WHERE id = $<groundId>`,
        statement,
      ))
      await toStatementData1(data, ground, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
  } else if (statement.type === "Citation") {
    if (statement.citedId) {
      const cited = entryToStatement(await db.oneOrNone(
        `SELECT * FROM statements
          WHERE id = $<citedId>`,
        statement,
      ))
      await toStatementData1(data, cited, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
    if (statement.eventId) {
      const event = entryToStatement(await db.oneOrNone(
        `SELECT * FROM statements
          WHERE id = $<eventId>`,
        statement,
      ))
      await toStatementData1(data, event, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
    if (statement.personId) {
      const person = entryToStatement(await db.oneOrNone(
        `SELECT * FROM statements
          WHERE id = $<personId>`,
        statement,
      ))
      await toStatementData1(data, person, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
  } else if (statement.type === "Property") {
    if (statement.statementId) {
      const statementWithProperties = entryToStatement(await db.oneOrNone(
        `SELECT * FROM statements
          WHERE id = $<statementId>`,
        statement,
      ))
      await toStatementData1(data, statementWithProperties, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
  } else if (statement.type === "Tag") {
    if (statement.statementId) {
      const taggedStatement = entryToStatement(await db.oneOrNone(
        `SELECT * FROM statements
          WHERE id = $<statementId>`,
        statement,
      ))
      await toStatementData1(data, taggedStatement, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
  }

  if (showAbuse) {
    const abuse = entryToStatement(await db.oneOrNone(
      `SELECT * FROM statements
        WHERE (data->>'statementId')::bigint = $<id> and type = 'Abuse'`,
      statement,
    ))
    statementJson.abuseId = abuse !== null ? abuse.id : null
    if (depth > 0 && abuse !== null) {
      await toStatementData1(data, abuse, statementsCache, user,
        {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
    }
  }
  if (showGrounds) {
    const groundArguments = (await db.any(
      `SELECT * FROM statements
        WHERE (data->>'claimId')::bigint = $<id>`,
      statement,
    )).map(entryToStatement)
    statementJson.groundIds = groundArguments.map(groundArgument => groundArgument.id)
    if (groundArguments.length > 0 && depth > 0) {
      for (let groundArgument of groundArguments) {
        await toStatementData1(data, groundArgument, statementsCache, user,
          {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
      }
      const groundStatements = (await db.any(
        `SELECT * FROM statements
          WHERE id IN ($1:csv)`,
        [groundArguments.map(groundArgument => groundArgument.groundId)],
      )).map(entryToStatement)
      for (let groundStatement of groundStatements) {
        await toStatementData1(data, groundStatement, statementsCache, user,
          {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showTags})
      }
    }
  }
  if (showProperties) {
    const properties = (await db.any(
      `SELECT * FROM statements
        WHERE (data->>'statementId')::bigint = $<id> and type = 'Property'`,
      statement,
    )).map(entryToStatement)
    let activePropertiesIds = properties.reduce(
      function (ids, property) {
        if (property.isActive) ids.push(property.id)
        return ids
      },
      [],
    )
    if (activePropertiesIds.length > 0) statement.activePropertiesIds = activePropertiesIds
    let ballotJsonById = data.ballots
    let userPropertiesIds = []
    for (let property of properties) {
      if (user) {
        let ballotId = [property.id, user.id].join("/")
        let ballot = ballotJsonById[ballotId]
        if (!ballot) {
          ballot = entryToBallot(await db.oneOrNone(
            "SELECT * FROM ballots WHERE statement_id = $1 AND voter_id = $2",
            [property.id, user.id],
          ))
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
    const tags = (await db.any(
      `SELECT * FROM statements
        WHERE (data->>'statementId')::bigint = $<id> and type = 'Tag'`,
      statement,
    )).map(entryToStatement)
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
      let user = entryToUser(await db.oneOrNone("SELECT * FROM users WHERE id = $1", statement.authorId))
      if (user !== null) userJsonById[statement.authorId] = toUserJson(user)
    }
  }

  if (showBallot && user) {
    let ballotJsonById = data.ballots
    let ballotId = [statement.id, user.id].join("/")
    statementJson.ballotId = ballotId
    if (!ballotJsonById[ballotId]) {
      let ballot = entryToBallot(await db.oneOrNone(
        "SELECT * FROM ballots WHERE statement_id = $1 AND voter_id = $2",
        [statement.id, user.id],
      ))
      if (ballot !== null) ballotJsonById[ballotId] = toBallotJson(ballot)
    }
  }
}


export function toStatementJson(statement) {
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
async function unrateStatement(statementId, voterId) {
  let ballot = {
    statementId,
    voterId,
  }
  let oldBallot = entryToBallot(await db.oneOrNone(
    "SELECT * FROM ballots WHERE statement_id = $<statementId> AND voter_id = $<voterId>",
    ballot,
  ))
  if (oldBallot !== null) {
    await db.none(
      "DELETE FROM ballots WHERE statement_id = $<statementId> AND voter_id = $<voterId>",
      ballot,
    )
    await addBallotAction(statementId)
  }
  return oldBallot
}


export const wrapAsyncMiddleware = fn => (...args) => fn(...args).catch(args[2])
