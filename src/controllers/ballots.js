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


import {db, entryToBallot} from "../database"
import {propagateOptimisticOptimization, rateStatement, toBallotData, unrateStatement,
    wrapAsyncMiddleware} from "../model"


export const deleteBallot = wrapAsyncMiddleware(async function deleteBallot(req, res) {
  // Delete a statement rating.
  let show = req.query.show || []
  let statement = req.statement

  let ballot = unrateStatement(statement.id, req.authenticatedUser.id)
  const statements = []
  if (ballot === null) {
    ballot = {
      // rating: null,
      statementId: statement.id,
      // updatedAt: ...,
      voterId: req.authenticatedUser.id,
    }
    statements.push(statement)
  } else {
    // Optimistic optimization
    if (statement.ratingCount) {
      const oldRating = statement.rating
      const oldRatingSum = statement.ratingSum
      statement = {...statement}
      statements.push(statement)
      statement.ratingCount -= 1
      if (statement.ratingCount === 0) {
        statement.rating = 0
        statement.ratingSum = 0
      } else {
        statement.ratingSum -= ballot.rating
        statement.ratingSum = Math.max(-statement.ratingCount, Math.min(statement.ratingCount, statement.ratingSum))
        statement.rating = statement.ratingSum / statement.ratingCount
      }
      await propagateOptimisticOptimization(statements, statement, oldRating, oldRatingSum)
    } else {
      statements.push(statement)
    }
    delete ballot.rating
    delete ballot.updatedAt
  }

  const data = await toBallotData(ballot, statements, req.authenticatedUser, {
    depth: req.query.depth || 0,
    showAbuse: show.includes("abuse"),
    showAuthor: show.includes("author"),
    showBallot: show.includes("ballot"),
    showGrounds: show.includes("grounds"),
    showProperties: show.includes("properties"),
    showTags: show.includes("tags"),
  })
  res.json({
    apiVersion: "1",
    data: data,
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
  let existingBallot = entryToBallot(await db.oneOrNone(
    "SELECT * FROM ballots WHERE statement_id = $<statementId> AND voter_id = $<voterId>",
    ballot,
  ))
  if (existingBallot !== null) ballot = existingBallot

  res.json({
    apiVersion: "1",
    data: await toBallotData(ballot, [statement], req.authenticatedUser, {
      depth: req.query.depth || 0,
      showAbuse: show.includes("abuse"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
      showProperties: show.includes("properties"),
      showTags: show.includes("tags"),
    }),
  })
})


export const upsertBallot = wrapAsyncMiddleware(async function upsertBallot(req, res) {
  // Insert or update a statement rating.
  let show = req.query.show || []
  let statement = req.statement
  let ratingData = req.body

  let [oldBallot, ballot] = await rateStatement(statement.id, req.authenticatedUser.id, ratingData.rating)
  if (oldBallot === null) res.status(201)  // Created

  // Optimistic optimizations
  const statements = []
  const oldRating = statement.rating
  const oldRatingSum = statement.ratingSum
  statements.push(statement)
  if (!statement.ratingCount) {
    statement.rating = 0
    statement.ratingCount = 0
    statement.ratingSum = 0
  }
  if (oldBallot === null) statement.ratingCount += 1
  statement.ratingSum += ballot.rating - (oldBallot === null ? 0 : oldBallot.rating)
  statement.ratingSum = Math.max(-statement.ratingCount, Math.min(statement.ratingCount, statement.ratingSum))
  statement.rating = statement.ratingSum / statement.ratingCount
  await propagateOptimisticOptimization(statements, statement, oldRating, oldRatingSum)

  res.json({
    apiVersion: "1",
    data: await toBallotData(ballot, statements, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showAbuse: show.includes("abuse"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
      showProperties: show.includes("properties"),
      showTags: show.includes("tags"),
    }),
  })
})
