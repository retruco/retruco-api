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


import assert from "assert"
import pgPromiseFactory from "pg-promise"

import config from "./config"
import {symbols, idBySymbol, symbolById} from "./symbols"


const pgPromise = pgPromiseFactory()
export const db = pgPromise({
  database: config.db.database,
  host: config.db.host,
  password: config.db.password,
  port: config.db.port,
  user: config.db.user,
})
export let dbSharedConnectionObject = null

export const versionNumber = 15
export const versionTextSearchNumber = 2


export {checkDatabase}
async function checkDatabase({ignoreTextSearchVersion = false} = {}) {
  // Check that database exists.
  dbSharedConnectionObject = await db.connect()

  assert(await existsTable("version"), 'Database is not initialized. Run "node configure" to configure it.')

  let version = await db.one("SELECT * FROM version")
  assert(version.number <= versionNumber, "Database format is too recent. Upgrade Retruco-API.")
  assert.strictEqual(version.number, versionNumber, 'Database must be upgraded. Run "node configure" to configure it.')
  assert(version.text <= versionTextSearchNumber, "Text search is too recent. Upgrade Retruco-API.")
  if (!ignoreTextSearchVersion) {
    assert.strictEqual(version.text, versionTextSearchNumber,
      'Text search must be upgraded. Run "node regenerate-text-search" to regenerate text search indexes.')
  }

  await checkSymbols()
}


export async function checkSymbols() {
  let results = await db.any(
    `
      SELECT symbols.id, symbol
      FROM objects
      INNER JOIN values ON objects.id = values.id
      INNER JOIN symbols ON objects.id = symbols.id
      WHERE symbol in ($<symbols:csv>)
    `,
    {
      symbols,
    },
  )
  for (let {id, symbol} of results) {
    idBySymbol[symbol] = id
    symbolById[id] = symbol
  }
  for (let symbol of symbols) {
    assert.notStrictEqual(idBySymbol[symbol], undefined,
      `Symbol "${symbol}" is missing. Run "node configure" to define it.`)
  }
}


async function existsTable(tableName) {
  return (await db.one("SELECT EXISTS(SELECT * FROM information_schema.tables WHERE table_name=$1)", [tableName]))
    .exists
}
