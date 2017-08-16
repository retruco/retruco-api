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

import assert from "assert"

import { db } from "./database"
import { getObjectFromId } from "./model"

export async function regenerateArguments(statementId, argumentKeysId) {
  let object = await getObjectFromId(statementId)
  assert.ok(object, `Missing objet at ID ${statementId}`)
  if (object.ratingSum === undefined) {
    // object is not a statement (aka not a rated object) => It has no argumentation.
    return
  }

  // Retrieve all the argumentation-related valid properties of the rated object, sorting by decreasing rating and id.

  let entry = await db.one(
    `
        SELECT count(properties.id) AS argument_count
        FROM statements
        INNER JOIN properties ON statements.id = properties.id
        WHERE properties.object_id = $<statementId>
        AND properties.key_id IN ($<argumentKeysId:csv>)
        AND NOT statements.trashed
        AND statements.rating_sum > 0
      `,
    {
      argumentKeysId,
      statementId,
    },
  )
  let argumentCount = entry.argument_count
  let argumentCountChanged = argumentCount !== object.argumentCount
  if (argumentCountChanged) object.argumentCount = argumentCount

  if (argumentCountChanged) {
    await db.none(
      `
          UPDATE statements
          SET argument_count = $<argumentCount>
          WHERE id = $<id>
        `,
      object,
    )
  }
}
