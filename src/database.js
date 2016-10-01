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
import rethinkdbdashFactory from "rethinkdbdash"

import config from "./config"
import {hashStatement} from "./model"


export const r = rethinkdbdashFactory({
    db: config.db.name,
    host: config.db.host,
    port: config.db.port,
  })

const versionNumber = 10


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
    await r.table("ballots").count()
  } catch (e) {
    // A primaryKey of type array is not supported yet.
    // await r.tableCreate("ballots", {primaryKey: [
    //   r.row("statementId"),
    //   r.row("voterId"),
    // ]})
    await r.tableCreate("ballots")
  }
  const ballotsTable = r.table("ballots")
  try {
    await ballotsTable.indexWait("statementId")
  } catch (e) {
    await ballotsTable.indexCreate("statementId")
  }
  try {
    await ballotsTable.indexWait("updatedAt")
  } catch (e) {
    await ballotsTable.indexCreate("updatedAt")
  }
  try {
    await ballotsTable.indexWait("voterId")
  } catch (e) {
    await ballotsTable.indexCreate("voterId")
  }

  try {
    await r.table("events").count()
  } catch (e) {
    await r.tableCreate("events")
  }
  const eventsTable = r.table("events")
  try {
    await eventsTable.indexWait("createdAt")
  } catch (e) {
    await eventsTable.indexCreate("createdAt")
  }
  try {
    await eventsTable.indexWait("statementIdAndType")
  } catch (e) {
    await eventsTable.indexCreate("statementIdAndType", [
      r.row("statementId"),
      r.row("type"),
    ])
  }

  try {
    await r.table("statements").count()
  } catch (e) {
    await r.tableCreate("statements")
  }
  const statementsTable = r.table("statements")
  try {
    await statementsTable.indexWait("claimId")
  } catch (e) {
    await statementsTable.indexCreate("claimId")
  }
  try {
    await statementsTable.indexWait("claimIdAndGroundId")
  } catch (e) {
    await statementsTable.indexCreate("claimIdAndGroundId", [
      r.row("claimId"),
      r.row("groundId"),
    ])
  }
  try {
    await statementsTable.indexWait("createdAt")
  } catch (e) {
    await statementsTable.indexCreate("createdAt")
  }
  try {
    await statementsTable.indexWait("groundId")
  } catch (e) {
    await statementsTable.indexCreate("groundId")
  }
  try {
    await statementsTable.indexWait("hash")
  } catch (e) {
    await statementsTable.indexCreate("hash")
  }
  try {
    await statementsTable.indexWait("languageCode")
  } catch (e) {
    await statementsTable.indexCreate("languageCode")
  }
  try {
    await statementsTable.indexWait("statementIdAndNameAndType")
  } catch (e) {
    await statementsTable.indexCreate("statementIdAndNameAndType", [
      r.row("statementId"),
      r.row("name"),
      r.row("type"),
    ])
  }
  try {
    await statementsTable.indexWait("statementIdAndType")
  } catch (e) {
    await statementsTable.indexCreate("statementIdAndType", [
      r.row("statementId"),
      r.row("type"),
    ])
  }
  try {
    await statementsTable.indexWait("tags")
  } catch (e) {
    await statementsTable.indexCreate("tags", {multi: true})
  }
  try {
    await statementsTable.indexWait("type")
  } catch (e) {
    await statementsTable.indexCreate("type")
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
    await usersTable.indexWait("email")
  } catch (e) {
    await usersTable.indexCreate("email")
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

  if (version.number === 0) version.number += 1
  if (version.number === 1) version.number += 1
  if (version.number === 2) {
    // Add type to statements.
    let statementsId = await statementsTable
      .filter(r.row.hasFields("type").not())
      .getField("id")
    for (let statementId of statementsId) {
      await statementsTable
        .get(statementId)
        .update({
          type: "PlainStatement",
        })
    }
    version.number += 1
  }
  if (version.number === 3) version.number += 1
  if (version.number === 4) version.number += 1
  if (version.number === 5) version.number += 1
  if (version.number === 6) {
    let users = await usersTable.filter(r.row.hasFields("email").not())
    for (let user of users) {
      await usersTable
        .get(user.id)
        .update({
          email: `${user.urlName}@localhost`,
        })
    }
    version.number += 1
  }
  if (version.number === 7) version.number += 1
  if (version.number === 8) {
    let statements = await statementsTable
    for (let statement of statements) {
      hashStatement(statement)
      await statementsTable
        .get(statement.id)
        .update({
          hash: statement.hash,
        })
    }
    version.number += 1
  }
  if (version.number === 9) {
    let arguments1 = await statementsTable.getAll("Argument", {index: "type"})
    for (let argument of arguments1) {
        if (!argument.argumentType) {
        await statementsTable
          .get(argument.id)
          .update({
            argumentType: "because",
          })
      }
    }
    version.number += 1
  }


  assert(version.number <= versionNumber,
    `Error in database upgrade script: Wrong version number: ${version.number} > ${versionNumber}.`)
  assert(version.number >= previousVersionNumber,
    `Error in database upgrade script: Wrong version number: ${version.number} < ${previousVersionNumber}.`)
  if (version.number !== previousVersionNumber) await versionTable.get(version.id).update({number: version.number})
}
