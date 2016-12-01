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


import {db, entryToStatement, hashStatement} from "../database"
import {generateObjectTextSearch, toStatementsData, wrapAsyncMiddleware} from "../model"


export const listStatementTags = wrapAsyncMiddleware(async function listStatementTags(req, res) {
  let show = req.query.show || []
  let statement = req.statement

  let tags = (await db.oneOrNone(
    `SELECT * FROM statements
      WHERE (data->>'statementId') = $<id>::text and type = 'Tag'`,
    statement,
  )).map(entryToStatement)
  res.json({
    apiVersion: "1",
    data: await toStatementsData(tags, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showAbuse: show.includes("tag"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showTags: show.includes("tags"),
    }),
  })
})


export const requireTag = wrapAsyncMiddleware(async function requireTag(req, res, next) {
  let statement = req.statement
  let tagName = req.params.tagName

  let tag = entryToStatement(await db.oneOrNone(
    `SELECT * FROM statements
      WHERE (data->>'name') = $<tagName> and (data->>'statementId') = $<id>::text and type = 'Tag'`,
    {
      id: statement.id,
      tagName,
    },
  ))
  if (tag === null) {
    tag = {
      name: tagName,
      statementId: statement.id,
    }
    const tagType = "Tag"
    let hash = hashStatement(tagType, tag)
    let result = await db.one(
      `INSERT INTO statements(created_at, hash, type, data)
        VALUES (current_timestamp, $1, $2, $3)
        RETURNING created_at, id, rating, rating_count, rating_sum`,
      [hash, tagType, tag],
    )
    Object.assign(tag, {
      createdAt: result.created_at,
      id: result.id,
      rating: result.rating,
      ratingCount: result.rating_count,
      ratingSum: result.rating_sum,
      type: tagType,
    })
    await generateObjectTextSearch(tag)
  }
  req.statement = tag

  return next()
})
