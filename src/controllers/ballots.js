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

import { db } from "../database"
import { entryToBallot, rateStatement, toBallotData, unrateStatement, wrapAsyncMiddleware } from "../model"

export const deleteBallot = wrapAsyncMiddleware(async function deleteBallot(req, res) {
  // Delete a statement rating.
  let show = req.query.show || []
  let statement = req.statement

  let ballot = await unrateStatement(statement, req.authenticatedUser.id)
  if (ballot === null) {
    ballot = {
      // rating: null,
      statementId: statement.id,
      // updatedAt: ...,
      voterId: req.authenticatedUser.id,
    }
  } else {
    delete ballot.rating
    delete ballot.updatedAt
  }
  ballot.id = `${ballot.statementId}/${ballot.voterId}`

  res.json({
    apiVersion: "1",
    data: await toBallotData(ballot, [statement], req.authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  })
})

export const getBallot = wrapAsyncMiddleware(async function getBallot(req, res) {
  // Respond an existing statement rating.
  let show = req.query.show || []
  let statement = req.statement

  let ballot = {
    statementId: statement.id,
    voterId: req.authenticatedUser.id,
  }
  let existingBallot = entryToBallot(
    await db.oneOrNone("SELECT * FROM ballots WHERE statement_id = $<statementId> AND voter_id = $<voterId>", ballot),
  )
  if (existingBallot !== null) ballot = existingBallot

  res.json({
    apiVersion: "1",
    data: await toBallotData(ballot, [statement], req.authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  })
})

export const upsertBallot = wrapAsyncMiddleware(async function upsertBallot(req, res) {
  // Insert or update a statement rating.
  let show = req.query.show || []
  let statement = req.statement
  let ratingData = req.body

  let [oldBallot, ballot] = await rateStatement(statement, req.authenticatedUser.id, ratingData.rating)
  if (oldBallot === null) res.status(201) // Created

  res.json({
    apiVersion: "1",
    data: await toBallotData(ballot, [statement], req.authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  })
})
