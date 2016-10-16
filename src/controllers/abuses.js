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


import {db, entryToStatement} from "../database"
import {hashStatement, wrapAsyncMiddleware} from "../model"


export const requireAbuse = wrapAsyncMiddleware(async function requireAbuse(req, res, next) {
  let statement = req.statement
  if (!["Argument", "PlainStatement"].includes(statement.type)) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `A statement of type ${statement.type} can't have an abuse statement.`,
    })
    return
  }
  let abuse = entryToStatement(await db.oneOrNone(
    `SELECT * FROM statements
      WHERE (data->>'statementId')::bigint = $<id> and type = 'Abuse'`,
    statement,
  ))
  if (abuse === null) {
    abuse = {
      statementId: statement.id,
    }
    const abuseType = 'Abuse'
    let hash = hashStatement(abuseType, abuse)
    let result = await db.one(
      `INSERT INTO statements(created_at, hash, type, data)
        VALUES (current_timestamp, $1, $2, $3)
        RETURNING created_at, id, rating, rating_count, rating_sum`,
      [hash, abuseType, abuse],
    )
    Object.assign(abuse, {
      createdAt: result.created_at,
      id: result.id,
      rating: result.rating,
      ratingCount: result.rating_count,
      ratingSum: result.rating_sum,
      type: abuseType,
    })
  }
  req.statement = abuse

  return next()
})
