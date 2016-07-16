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
import {toStatementsData, wrapAsyncMiddleware} from "../model"


export const listStatementTags = wrapAsyncMiddleware(async function listStatementTags(req, res, next) {
  let show = req.query.show || []
  let statement = req.statement

  let tags = await r
    .table("statements")
    .getAll([statement.id, "Tag"], {index: "statementIdAndType"})
  res.json({
    apiVersion: "1",
    data: await toStatementsData(tags, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showAbuse: show.includes("abuse"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
      showTags: show.includes("tags"),
    }),
  })
})


export const requireTag = wrapAsyncMiddleware(async function requireTag(req, res, next) {
  let statement = req.statement
  let tagName = req.params.tagName

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
  req.statement = tag

  return next()
})
