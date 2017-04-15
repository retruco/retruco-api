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

import { checkDatabase, db } from "../src/database"
import { getIdFromSymbol } from "../src/symbols"

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
    label: "bg",
    value: "bg",
  },
  {
    label: "cs",
    value: "cs",
  },
  {
    label: "da",
    value: "da",
  },
  {
    label: "de",
    value: "de",
  },
  {
    label: "el",
    value: "el",
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
    label: "et",
    value: "et",
  },
  {
    label: "fi",
    value: "fi",
  },
  {
    label: "fr",
    value: "fr",
  },
  {
    label: "ga",
    value: "ga",
  },
  {
    label: "hr",
    value: "hr",
  },
  {
    label: "hu",
    value: "hu",
  },
  {
    label: "it",
    value: "it",
  },
  {
    label: "lt",
    value: "lt",
  },
  {
    label: "lv",
    value: "lv",
  },
  {
    label: "mt",
    value: "mt",
  },
  {
    label: "nl",
    value: "nl",
  },
  {
    label: "pl",
    value: "pl",
  },
  {
    label: "pt",
    value: "pt",
  },
  {
    label: "ro",
    value: "ro",
  },
  {
    label: "sk",
    value: "sk",
  },
  {
    label: "sl",
    value: "sl",
  },
  {
    label: "sv",
    value: "sv",
  },
]

async function extractLocalizedStrings() {
  let localizations = await db.any(
    `
      SELECT
        objects.id,
        symbol,
        value->>'bg' as bg,
        value->>'cs' as cs,
        value->>'da' as da,
        value->>'de' as de,
        value->>'el' as el,
        value->>'en' as en,
        value->>'es' as es,
        value->>'et' as et,
        value->>'fi' as fi,
        value->>'fr' as fr,
        value->>'ga' as ga,
        value->>'hr' as hr,
        value->>'hu' as hu,
        value->>'it' as it,
        value->>'lt' as lt,
        value->>'lv' as lv,
        value->>'mt' as mt,
        value->>'nl' as nl,
        value->>'pl' as pl,
        value->>'pt' as pt,
        value->>'ro' as ro,
        value->>'sk' as sk,
        value->>'sl' as sl,
        value->>'sv' as sv
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
      nameId: getIdFromSymbol("name"),
      schemaId: getIdFromSymbol("schema:localized-string"),
    },
  )
  const csvString = json2csv({
    data: localizations,
    fields,
  })
  console.log(csvString)

  process.exit(0)
}

checkDatabase().then(extractLocalizedStrings).catch(error => {
  console.log(error.stack || error)
  process.exit(1)
})
