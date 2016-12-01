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


import json2csv from "json2csv"

import {checkDatabase, db} from "../src/database"
import {getIdFromSymbolOrFail} from "../src/symbols"


const fields = [
  {
    label: "ID",
    value: "id",
  },
  {
    label: "Symbol",
    value: "symbol",
  },
  {
    label: "en",
    value: "en",
  },
  {
    label: "es",
    value: "es",
  },
  {
    label: "fr",
    value: "fr",
  },
]


async function extractLocalizedStrings() {
  let localizations = await db.any(
    `
      SELECT
        objects.id,
        symbol,
        value->>'en' AS en,
        value->>'es' AS es,
        value->>'fr' AS fr
      FROM objects
      INNER JOIN values on objects.id = values.id
      LEFT JOIN symbols ON objects.id = symbols.id
      WHERE values.schema_id = $<schemaId>
      AND objects.id IN (
        SELECT value_id
        FROM properties
        WHERE key_id != $<nameId>
        )
      ORDER BY id
    `,
    {
      nameId: getIdFromSymbolOrFail("name"),
      schemaId: getIdFromSymbolOrFail("schema:localized-string"),
    },
  )
  const csvString = json2csv({
    data: localizations,
    fields,
  })
  console.log(csvString)

  process.exit(0)
}


checkDatabase()
  .then(extractLocalizedStrings)
  .catch(error => {
    console.log(error.stack || error)
    process.exit(1)
  })
