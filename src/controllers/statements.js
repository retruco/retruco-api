// Retruco-API -- HTTP API to bring out shared positions from argumented statements
// By: Paula Forteza <paula@retruco.org>
//     Emmanuel Raviart <emmanuel@retruco.org>
//
// Copyright (C) 2016, 2017 Paula Forteza & Emmanuel Raviart
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

import { getObjectFromId, wrapAsyncMiddleware } from "../model"
import { getIdFromIdOrSymbol } from "../symbols"

export const requireStatement = wrapAsyncMiddleware(async function requireStatement(req, res, next) {
  let id = getIdFromIdOrSymbol(req.params.idOrSymbol)
  if (!id) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No statement with symbol "${req.params.idOrSymbol}".`,
    })
    return
  }
  let statement = await getObjectFromId(id)
  if (statement === null) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No statement with ID or symbol "${req.params.idOrSymbol}".`,
    })
    return
  }
  if (statement.ratingCount === undefined) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `Object "${req.params.idOrSymbol}" is not a rated object.`,
    })
    return
  }

  req.statement = statement

  return next()
})
