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


export {requireArgument}
async function requireArgument(ctx, next) {
  let statement = ctx.statement

  let groundId = ctx.parameter.groundId
  let ground = await r
    .table("statements")
    .get(groundId)
  if (ground === null) {
    ctx.status = 404
    ctx.body = {
      apiVersion: "1",
      code: 404,
      message: `No ground statement with ID "${groundId}".`,
    }
    return
  }

  let args = await r
    .table("statements")
    .getAll([statement.id, ground.id], {index: "claimIdAndGroundId"})
    .limit(1)
  let argument
  if (args.length < 1) {
    // Create an argument when it is missing. Never return a 404.
    argument = {
      claimId: statement.id,
      createdAt: r.now(),
      groundId: ground.id,
      type: "Argument",
    }
    let result = await r
      .table("statements")
      .insert(argument, {returnChanges: true})
    argument = result.changes[0].new_val
  } else {
    argument = args[0]
  }
  ctx.statement = argument

  await next()
}
