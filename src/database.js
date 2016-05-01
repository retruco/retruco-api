// Retruco-API -- HTTP API to bring out shared positions from argumented statements
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


import assert from "assert"
import rethinkdbdashFactory from "rethinkdbdash"

import config from "./config"


export const r = rethinkdbdashFactory({
    db: config.db.name,
    host: config.db.host,
    port: config.db.port,
  })

const versionNumber = 0


export {checkDatabase}
async function checkDatabase() {
  const databasesName = await r.dbList()
  assert(databasesName.includes(config.db.name), 'Database is not initialized. Run "node configure" to configure it.')
  let versions
  try {
    versions = await r.table("version")
  } catch (e) {
    throw new Error('Database is not initialized. Run "node configure" to configure it.')
  }
  assert(versions.length > 0, 'Database is not initialized. Run "node configure" to configure it.')
  assert.strictEqual(versions.length, 1)
  const version = versions[0]
  assert(version.number <= versionNumber, "Database format is too recent. Upgrade Retruco-API.")
  assert.strictEqual(version.number, versionNumber, 'Database must be upgraded. Run "node configure" to configure it.')
}


export {configure}
async function configure() {
  const databasesName = await r.dbList()
  if (!databasesName.includes(config.db.name)) {
    await r.dbCreate(config.db.name)
    await r.tableCreate("version")
    await r.table("version").insert({number: versionNumber})
  }

  try {
    await r.table("statements").count()
  } catch (e) {
    await r.tableCreate("statements")
  }
  const statementsTable = r.table("statements")
  try {
    await statementsTable.indexWait("createdAt")
  } catch (e) {
    await statementsTable.indexCreate("createdAt")
  }
  try {
    await statementsTable.indexWait("languageCode")
  } catch (e) {
    await statementsTable.indexCreate("languageCode")
  }

  try {
    await r.table("users").count()
  } catch (e) {
    await r.tableCreate("users")
  }
  const usersTable = r.table("users")
  try {
    await usersTable.indexWait("apiKey")
  } catch (e) {
    await usersTable.indexCreate("apiKey")
  }
  try {
    await usersTable.indexWait("createdAt")
  } catch (e) {
    await usersTable.indexCreate("createdAt")
  }
  try {
    await usersTable.indexWait("urlName")
  } catch (e) {
    await usersTable.indexCreate("urlName")
  }

  try {
    await r.table("version").count()
  } catch (e) {
    await r.tableCreate("version")
  }
  const versionTable = r.table("version")
  const versions = await versionTable
  let version
  if (versions.length === 0) {
    let result = await versionTable.insert({number: 0}, {returnChanges: true})
    version = result.changes[0].new_val
  } else {
    assert.strictEqual(versions.length, 1)
    version = versions[0]
  }
  assert(version.number <= versionNumber, "Database format is too recent. Upgrade Retruco-API.")

  const previousVersionNumber = version.number

  // if (version.number === 0) {
  //   // TODO
  //
  //   version.number += 1
  // }

  assert(version.number <= versionNumber,
    `Error in database upgrade script: Wrong version number: ${version.number} > ${versionNumber}.`)
  assert(version.number >= previousVersionNumber,
    `Error in database upgrade script: Wrong version number: ${version.number} < ${previousVersionNumber}.`)
  if (version.number !== previousVersionNumber) await versionTable.get(version.id).update({number: version.number})
}
