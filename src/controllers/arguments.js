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


export const requireArgument = wrapAsyncMiddleware(async function requireArgument(req, res, next) {
  let statement = req.statement

  let groundId = req.params.groundId
  let ground = entryToStatement(await db.oneOrNone(`SELECT * FROM statements WHERE id = $1`, groundId))
  if (ground === null) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No ground statement with ID "${groundId}".`,
    })
    return
  }

  let argument = entryToStatement(await db.oneOrNone(
    `SELECT * FROM statements
      WHERE (data->>'claimId')::bigint = $<claimId> and (data->>'groundId')::bigint = $<groundId>`,
    {
      claimId: statement.id,
      groundId: ground.id,
    }
  ))
  if (argument === null) {
    // Create an argument when it is missing. Never return a 404.
    argument = {
      claimId: statement.id,
      groundId: ground.id,
    }
    const argumentType = 'Argument'
    let hash = hashStatement(argumentType, argument)
    let result = await db.one(
      `INSERT INTO statements(created_at, hash, type, data)
        VALUES (current_timestamp, $1, $2, $3)
        RETURNING created_at, id, rating, rating_count, rating_sum`,
      [hash, argumentType, argument],
    )
    Object.assign(argument, {
      createdAt: result.created_at,
      id: result.id,
      rating: result.rating,
      ratingCount: result.rating_count,
      ratingSum: result.rating_sum,
      type: argumentType,
    })
  }
  req.statement = argument

  return next()
})
