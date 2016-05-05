// Retruco-API -- HTTP API to bring out shared positions from argumented statements
// By: Paula Forteza <paula@gouv2.fr>
//     Emmanuel Raviart <emmanuel@gouv2.fr>
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
