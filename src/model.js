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


import {r} from "./database"


export {addStatementRatingEvent}
async function addStatementRatingEvent(statementId) {
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


export function ownsUser(user, otherUser) {
  if (!user) return false
  if (user.isAdmin) return true
  return user.id === otherUser.id
}


export {toStatementData}
async function toStatementData(statement, {depth = 0, showAuthor = false, showGrounds = false, showTags = false} = {}) {
  let data = {
    id: statement.id,
    statements: {},
    users: {},
  }

  await toStatementData1(data, statement, {depth, showAuthor, showGrounds, showTags})

  if (Object.keys(data.statements).length === 0) delete data.statements
  if (Object.keys(data.users).length === 0) delete data.users
  return data
}


async function toStatementData1(data, statement, {depth = 0, showAuthor = false, showGrounds = false,
  showTags = false} = {}) {
  let statementJsonById = data.statements
  if (statementJsonById[statement.id]) return

  const statementJson = toStatementJsonSync(statement)
  statementJsonById[statement.id] = statementJson
  if (showGrounds) {
    const groundArguments = await r
      .table("statements")
      .getAll(statement.id, {index: "claimId"})
    statementJson.groundIds = groundArguments.map(groundArgument => groundArgument.id)
    if (depth > 0) {
      for (let groundArgument of groundArguments) {
        if (!statementJsonById[groundArgument.id]) {
          await toStatementData1(data, groundArgument, {depth: depth - 1, showAuthor, showGrounds, showTags})
        }
      }
      const groundStatements = await r
        .table("statements")
        .getAll(...groundArguments.map(groundArgument => groundArgument.groundId))
      for (let groundStatement of groundStatements) {
        if (!statementJsonById[groundStatement.id]) {
          await toStatementData1(data, groundStatement, {depth: depth - 1, showAuthor, showGrounds, showTags})
        }
      }
    }
  }
  if (showTags) {
    const tags = await r
      .table("statements")
      .getAll([statement.id, "Tag"], {index: "statementIdAndType"})
    statementJson.tagIds = tags.map(tag => tag.id)
    if (depth > 0) {
      for (let tag of tags) {
        if (!statementJsonById[tag.id]) {
          await toStatementData1(data, tag, {depth: depth - 1, showAuthor, showGrounds, showTags})
        }
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
}


export {toStatementJson}
async function toStatementJson(statement, {showAuthorName = false} = {}) {
  let statementJson = {...statement}
  if (statement.type === "PlainStatement") {
    if (showAuthorName && statement.authorId) {
      statementJson.authorName = await r
        .table("users")
        .get(statement.authorId)
        .getField("urlName")
    }
    delete statementJson.authorId
  }
  statementJson.createdAt = statementJson.createdAt.toISOString()
  return statementJson
}


// TODO: Remove toStatementJson and rename toStatementJsonSync to toStatementJson.
function toStatementJsonSync(statement) {
  let statementJson = {...statement}
  statementJson.createdAt = statementJson.createdAt.toISOString()
  return statementJson
}


export {toStatementsData}
async function toStatementsData(statements,
  {depth = 0, showAuthor = false, showGrounds = false, showTags = false} = {}) {
  let data = {
    ids: statements.map(statement => statement.id),
    statements: {},
    users: {},
  }

  for (let statement of statements) {
    await toStatementData1(data, statement, {depth, showAuthor, showGrounds, showTags})
  }

  if (Object.keys(data.statements).length === 0) delete data.statements
  if (Object.keys(data.users).length === 0) delete data.users
  return data
}


export {toUserJson}
function toUserJson(user, {showApiKey = false} = {}) {
  let userJson = {...user}
  if (!showApiKey) delete userJson.apiKey
  userJson.createdAt = userJson.createdAt.toISOString()
  // delete userJson.id
  delete userJson.passwordDigest
  delete userJson.salt
  return userJson
}
