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


import {r} from "../database"
import {addBallotEvent, rateStatement, toBallotData, wrapAsyncMiddleware} from "../model"


export const deleteBallot = wrapAsyncMiddleware(async function deleteBallot(req, res, next) {
  // Delete a statement rating.
  let show = req.query.show || []
  let statement = req.statement

  let id = [statement.id, req.authenticatedUser.id].join("/")
  let ballot = await r
    .table("ballots")
    .get(id)
  const statements = []
  if (ballot === null) {
    ballot = {
      id,
      // rating: null,
      statementId: statement.id,
      // updatedAt: r.now(),
      voterId: req.authenticatedUser.id,
    }
    statements.push(statement)
  } else {
    await r
      .table("ballots")
      .get(id)
      .delete()
    await addBallotEvent(statement.id)

    // Optimistic optimization
    if (statement.ratingCount) {
      const oldRating = statement.rating
      const oldRatingSum = statement.ratingSum
      statement = {...statement}
      statements.push(statement)
      statement.ratingCount -= 1
      if (statement.ratingCount === 0) {
        delete statement.rating
        delete statement.ratingCount
        delete statement.ratingSum
      } else {
        statement.ratingSum -= ballot.rating
        statement.ratingSum = Math.max(-statement.ratingCount, Math.min(statement.ratingCount, statement.ratingSum))
        statement.rating = statement.ratingSum / statement.ratingCount
      }
      await propageOptimisticOptimization(statements, statement, oldRating, oldRatingSum)
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


export const getBallot = wrapAsyncMiddleware(async function getBallot(req, res, next) {
  // Respond an existing statement rating.
  let show = req.query.show || []
  let statement = req.statement

  let id = [statement.id, req.authenticatedUser.id].join("/")
  let ballot = await r
    .table("ballots")
    .get(id)
  if (ballot === null) {
    ballot = {
      id,
      // rating: null,
      statementId: statement.id,
      // updatedAt: r.now(),
      voterId: req.authenticatedUser.id,
    }
  }

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


async function propageOptimisticOptimization(statements, statement, oldRating, oldRatingSum) {
  const newRatingCount = statement.ratingCount !== undefined ? statement.ratingCount : 0
  const newRating = newRatingCount > 0 ? statement.rating : 0
  const newRatingSum = newRatingCount > 0 ? statement.ratingSum : 0
  if (oldRating === undefined) oldRating = 0
  if (oldRatingSum === undefined) oldRatingSum = 0

  if (statement.type === "Abuse") {
    if (oldRatingSum <= 0 && newRatingSum > 0 || oldRatingSum > 0 && newRatingSum <= 0) {
      let flaggedStatement = await r
        .table("statements")
        .get(statement.statementId)
      if (flaggedStatement !== null) {
        if (newRatingSum > 0) flaggedStatement.isAbuse = true
        else delete flaggedStatement.isAbuse
        statements.push(flaggedStatement)
      }
    }
  } else if (statement.type === "Argument") {
    if (!statement.isAbuse) {
      let oldRoundedRating = oldRating < -1 / 3 ? -1 : oldRating <= 1 / 3 ? 0 : 1
      let newRoundedRating = newRating < -1 / 3 ? -1 : newRating <= 1 / 3 ? 0 : 1
      if (oldRoundedRating !== newRoundedRating) {
        let claim = await r
          .table("statements")
          .get(statement.claimId)
        let ground = await r
          .table("statements")
          .get(statement.groundId)
        if (claim !== null && claim.ratingCount && ground !== null && !ground.isAbuse) {
          claim.ratingSum = (claim.ratingSum || 0) + (newRoundedRating - oldRoundedRating) * (ground.ratingSum || 0)
          claim.ratingSum = Math.max(-claim.ratingCount, Math.min(claim.ratingCount, claim.ratingSum))
          claim.rating = claim.ratingSum / claim.ratingCount
          statements.push(claim)
        }
      }
    }
  }
}


export const upsertBallot = wrapAsyncMiddleware(async function upsertBallot(req, res, next) {
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
  statement = {...statement}
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
  await propageOptimisticOptimization(statements, statement, oldRating, oldRatingSum)

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
