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
import deepEqual from "deep-equal"

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

    let argumentation = (await db.any(
      `
        SELECT properties.id as id, properties.key_id as key_id, rating, rating_count, rating_sum, values.id as value_id
        FROM objects
        INNER JOIN statements ON objects.id = statements.id
        INNER JOIN properties ON statements.id = properties.id
        INNER JOIN values ON properties.value_id = values.id
        WHERE properties.object_id = $<statementId>
        AND properties.key_id IN ($<argumentKeysId:csv>)
        AND NOT trashed
        AND rating_sum > 0
        ORDER BY rating_sum DESC, objects.id DESC
      `,
      {
        argumentKeysId,
        statementId,
      },
    )).map(argument => {
      argument.keyId = argument.key_id
      delete argument.key_id
      argument.ratingCount = argument.rating_count
      delete argument.rating_count
      argument.ratingSum = argument.rating_sum
      delete argument.rating_sum
      argument.valueId = argument.value_id
      delete argument.value_id
      return argument
    })

    let argumentsChanged = false
    if (argumentation.length > 0) {
      if (!deepEqual(argumentation, object.arguments)) {
        object.arguments = argumentation
        argumentsChanged = true
      }
    } else if (object.arguments !== null) {
      object.arguments = null
      argumentsChanged = true
    }

    if (argumentsChanged) {
      await db.none(
        `
          UPDATE statements
          SET arguments = $<arguments:json>
          WHERE id = $<id>
        `,
        object,
      )
    }
  }
