// Retruco-API -- HTTP API to bring out shared positions from argumented arguments
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


import {r} from "../database"
import {toStatementsData} from "../model"


export {listStatementTags}
async function listStatementTags(ctx) {
  let show = ctx.parameter.show || []
  let statement = ctx.statement

  let tags = await r
    .table("statements")
    .getAll([statement.id, "Tag"], {index: "statementIdAndType"})
  ctx.body = {
    apiVersion: "1",
    data: await toStatementsData(tags, ctx.authenticatedUser, {
      depth: ctx.parameter.depth || 0,
      showAbuse: show.includes("abuse"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
      showTags: show.includes("tags"),
    }),
  }
}


export {requireTag}
async function requireTag(ctx, next) {
  let statement = ctx.statement
  let tagName = ctx.parameter.tagName

  let tags = await r
    .table("statements")
    .getAll([statement.id, tagName, "Tag"], {index: "statementIdAndNameAndType"})
    .limit(1)
  let tag
  if (tags.length < 1) {
    tag = {
      createdAt: r.now(),
      name: tagName,
      statementId: statement.id,
      type: "Tag",
    }
    let result = await r
      .table("statements")
      .insert(tag, {returnChanges: true})
    tag = result.changes[0].new_val
  } else {
    tag = tags[0]
  }
  ctx.statement = tag

  await next()
}
