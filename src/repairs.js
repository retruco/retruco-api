// Retruco-API -- HTTP API to bring out shared positions from argumented statements
// By: Paula Forteza <paula@retruco.org>
//     Emmanuel Raviart <emmanuel@retruco.org>
//
// Copyright (C) 2016, 2017 Paula Forteza & Emmanuel Raviart
// https://framagit.org/retruco/retruco-api
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

import { db } from "./database"
import { describe, entryToValue } from "./model"
import { getIdFromSymbol } from "./symbols"

export async function cleanupObjectsProperties() {
  console.log('Removing dangling keys and values from "properties" attribute of objects...')
  let objects = await db.any(
    `
      SELECT *
      FROM objects
      WHERE properties IS NOT null
      ORDER BY id
    `,
  )
  for (let object of objects) {
    let changed = false
    for (let [key_id, value_ids] of Object.entries({ ...object.properties })) {
      if (!(await db.one("SELECT EXISTS (SELECT 1 FROM objects WHERE id = $1)", key_id)).exists) {
        delete object.properties[key_id]
        changed = true
        continue
      }

      let valueIdsChanged = false
      if (!Array.isArray(value_ids)) {
        value_ids = [value_ids]
      }
      for (let value_id of [...value_ids]) {
        if (!(await db.one("SELECT EXISTS (SELECT 1 FROM objects WHERE id = $1)", value_id)).exists) {
          value_ids.splice(value_ids.indexOf(value_id), 1)
          valueIdsChanged = true
          changed = true
        }
      }
      if (valueIdsChanged) {
        if (value_ids.length === 0) {
          delete object.properties[key_id]
        } else {
          if (value_ids.length === 1) {
            value_ids = value_ids[0]
          }
          object.properties[key_id] = value_ids
        }
      }
    }
    if (changed) {
      console.log(`  Cleaned up "properties" attribute of object ${object.id}...`)
      await db.none(
        `
          UPDATE objects
          SET properties = $<properties:json>
          WHERE id = $<id>
        `,
        object,
      )
    }
  }
  console.log('All "properties" attributes of objects have been cleaned up.')
}

export async function collectGarbage() {
  console.log("Collecting garbage of incomplete values...")
  let entries = await db.any(
    `
      SELECT objects.id
      FROM objects
      LEFT JOIN values ON objects.id = values.id
      LEFT JOIN statements ON objects.id = statements.id
      LEFT JOIN symbols ON objects.id = symbols.id
      WHERE objects.type = 'Value'
      AND values.id IS null
      AND statements.id IS null
      AND symbol IS null
      AND objects.id NOT IN (SELECT objects.id FROM properties WHERE key_id = objects.id)
      AND objects.id NOT IN (SELECT objects.id FROM properties WHERE value_id = objects.id)
      AND objects.id NOT IN (
        SELECT objects.id
        FROM properties
        INNER JOIN values ON properties.value_id = values.id
        WHERE values.schema_id = $<idsArraySchemaId>
        AND values.value @> to_jsonb(objects.id::text)
      )
    `,
    {
      idsArraySchemaId: getIdFromSymbol("schema:ids-array"),
    },
  )
  for (let entry of entries) {
    console.log(`  Deleting ${entry.id}...`)
    await db.none("DELETE FROM objects WHERE id = $<id>", entry)
  }
  console.log("Garbage collection of incomplete values done.")

  console.log("Collecting garbage of unused values...")
  let typedValues = (await db.any(
    `
      SELECT objects.*, values.*, argument_count, rating, rating_count, rating_sum, symbol, trashed
      FROM objects
      INNER JOIN values ON objects.id = values.id
      LEFT JOIN statements ON objects.id = statements.id
      LEFT JOIN symbols ON objects.id = symbols.id
      WHERE statements.id IS null
      AND symbol IS null
      AND objects.id NOT IN (SELECT objects.id FROM properties WHERE key_id = objects.id)
      AND objects.id NOT IN (SELECT objects.id FROM properties WHERE value_id = objects.id)
      AND objects.id NOT IN (
        SELECT objects.id
        FROM properties
        INNER JOIN values ON properties.value_id = values.id
        WHERE values.schema_id = $<idsArraySchemaId>
        AND values.value @> to_jsonb(objects.id::text)
      )
    `,
    {
      idsArraySchemaId: getIdFromSymbol("schema:ids-array"),
    },
  )).map(entryToValue)
  for (let typedValue of typedValues) {
    let description = await describe(typedValue)
    console.log(`  Deleting ${description}...`)
    await db.none("DELETE FROM objects WHERE id = $<id>", typedValue)
  }
  console.log("Garbage collection of unused values done.")

  console.log("Collecting garbage of incomplete properties...")
  entries = await db.any(
    `
      SELECT objects.id
      FROM objects
      LEFT JOIN properties ON objects.id = properties.id
      WHERE objects.type = 'Property'
      AND properties.id IS null
    `,
  )
  for (let entry of entries) {
    console.log(`  Deleting ${entry.id}...`)
    await db.none("DELETE FROM objects WHERE id = $<id>", entry)
  }
  console.log("Garbage collection of incomplete properties done.")
}

export async function replaceId(oldId, newId, idBySymbol) {
  console.log(`Replacing ${oldId} with ${newId}...`)
  await db.none(
    `
      UPDATE properties
      SET key_id = $<newId>
      WHERE key_id = $<oldId>
    `,
    {
      newId,
      oldId,
    },
  )
  await db.none(
    `
      UPDATE properties
      SET object_id = $<newId>
      WHERE object_id = $<oldId>
    `,
    {
      newId,
      oldId,
    },
  )
  await db.none(
    `
      UPDATE properties
      SET value_id = $<newId>
      WHERE value_id = $<oldId>
    `,
    {
      newId,
      oldId,
    },
  )
  await db.none(
    `
      UPDATE symbols
      SET id = $<newId>
      WHERE id = $<oldId>
    `,
    {
      newId,
      oldId,
    },
  )

  let typedIdsArrays = await db.any(
    `
      SELECT *
      FROM values
      WHERE schema_id = $<schemaId>
      AND value @> $<oldId:json>
    `,
    {
      oldId,
      schemaId: idBySymbol["schema:ids-array"],
    },
  )
  for (let typedIdsArray of typedIdsArrays) {
    typedIdsArray.value = typedIdsArray.value.map(id => (id === oldId ? newId : id))
    await db.none(
      `
        UPDATE values
        SET value = $<value:json>
        WHERE id = $<id>
      `,
      typedIdsArray,
    )
  }

  let statement = await db.oneOrNone(
    `
      SELECT *
      FROM statements
      WHERE id = $<oldId>
    `,
    {
      oldId,
    },
  )
  if (statement !== null) {
    statement.id = newId
    await db.none(
      `
        INSERT INTO statements(argument_count, id, rating, rating_count, rating_sum, trashed)
        VALUES ($<argument_count>, $<id>, $<rating>, $<rating_count>, $<rating_sum>, $<trashed>)
      `,
      statement,
    )
    await db.none(
      `
        UPDATE ballots
        SET statement_id = $<newId>
        WHERE statement_id = $<oldId>
      `,
      {
        newId,
        oldId,
      },
    )
    await db.none(
      `
        DELETE
        FROM statements
        WHERE id = $<oldId>
      `,
      {
        oldId,
      },
    )
  }
}
