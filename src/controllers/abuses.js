// Retruco-API -- HTTP API to bring out shared positions from argumented arguments
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


import {r} from "../database"


export {requireAbuse}
async function requireAbuse(ctx, next) {
  let statement = ctx.statement
  if (statement.type === "Abuse") {
    ctx.status = 404
    ctx.body = {
      apiVersion: "1",
      code: 404,
      message: "An abuse statement can't have its own abuse statement.",
    }
    return
  }
  let abuses = await r
    .table("statements")
    .getAll([statement.id, "Abuse"], {index: "statementIdAndType"})
    .limit(1)
  let abuse
  if (abuses.length < 1) {
    abuse = {
      createdAt: r.now(),
      statementId: statement.id,
      type: "Abuse",
    }
    let result = await r
      .table("statements")
      .insert(abuse, {returnChanges: true})
    abuse = result.changes[0].new_val
  } else {
    abuse = abuses[0]
  }
  ctx.statement = abuse

  await next()
}
