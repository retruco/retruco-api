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

import {checkDatabase, db, entryToStatement, generateStatementTextSearch, versionTextSearchNumber} from "./database"


async function generateTextSearch () {
  let version = await db.one("SELECT * FROM version")
  assert(version.text <= versionTextSearchNumber,
    `Text search is too recent for current version of application: ${version.text} > ${versionTextSearchNumber}.`)
  if (version.text < versionTextSearchNumber) {
    console.log(`Upgrading text search indexes from version ${version.text} to ${versionTextSearchNumber}...`)
  }

  let statements = (await db.any("SELECT * FROM statements")).map(entryToStatement)
  for (let statement of statements) {
    await generateStatementTextSearch(statement)
  }

  if (version.text < versionTextSearchNumber) {
    await db.none("UPDATE version SET text = $1", versionTextSearchNumber)
    version.text = versionTextSearchNumber
    console.log(`Upgraded text search indexes to version ${version.text}.`)
  }

  process.exit(0)
}


checkDatabase({ignoreTextSearchVersion: true})
  .then(generateTextSearch)
  .catch(error => {
    console.log(error.stack)
    process.exit(1)
  })
