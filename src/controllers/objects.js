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


import {getObjectFromId, toDataJson, wrapAsyncMiddleware} from "../model"
import {idBySymbol} from "../symbols"


export const getObject = wrapAsyncMiddleware(async function getObject(req, res) {
  // Respond an existing statement.

  let show = req.query.show || []
  res.json({
    apiVersion: "1",
    data: await toDataJson(req.object, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  })
})


export const requireObject = wrapAsyncMiddleware(async function requireObject(req, res, next) {
  let id = req.params.idOrSymbol
  if (isNaN(parseInt(id))) {
    // ID is a symbol.
    let symbol = id
    id = idBySymbol[symbol]
    if (id === undefined) {
      res.status(404)
      res.json({
        apiVersion: "1",
        code: 404,
        message: `No object with symbol "${symbol}".`,
      })
      return
    }
  }
  let object = await getObjectFromId(id)
  if (object === null) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No object with ID "${id}".`,
    })
    return
  }
  req.object = object

  return next()
})
