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


import config from "../config"
import {db, entryToStatement, entryToUser, hashStatement} from "../database"
import {generateObjectTextSearch, languageConfigurationNameByCode, ownsUser, propagateOptimisticOptimization,
  rateStatement, toStatementData, toStatementsData, toStatementJson, types, wrapAsyncMiddleware} from "../model"


export const autocompleteStatements = wrapAsyncMiddleware(async function autocompleteStatements(req, res) {
  // Respond a list of statements.
  let language = req.query.language
  let limit = req.query.limit || 10
  let queryTypes = req.query.type || []
  let term = req.query.term

  let whereClauses = []

  if (language) {
    whereClauses.push("data->>'language' = $<language> OR data->'language' IS NULL")
  }

  let cardTypes = []
  let statementTypes = []
  for (let type of queryTypes) {
    if (types.includes(type)) statementTypes.push(type)
    else cardTypes.push(type)
  }
  if (cardTypes.length > 0) {
    whereClauses.push("data->'values'->'Card Type' ?| array[$<cardTypes:csv>]")
  }
  if (statementTypes.length > 0) {
    whereClauses.push("type IN ($<statementTypes:csv>)")
  }

  let whereClause = whereClauses.length === 0 ? "" : "WHERE " + whereClauses.join(" AND ")

  let statementsEntries = await db.any(
    `SELECT statements.*, statements_autocomplete.autocomplete,
        statements_autocomplete.autocomplete <-> $<term> AS distance
      FROM statements
      LEFT JOIN statements_autocomplete ON statements.id = statements_autocomplete.statement_id
      ${whereClause}
      ORDER BY distance
      LIMIT $<limit>`,
    {
      cardTypes,
      language,
      limit,
      statementTypes,
      term: term || "",
    }
  )

  res.json({
    apiVersion: "1",
    data: statementsEntries.map(function (statementEntry) {
      let autocomplete = statementEntry.autocomplete
      delete statementEntry.autocomplete
      let distance = statementEntry.distance
      delete statementEntry.distance
      return {
        autocomplete,
        distance,
        statement: toStatementJson(entryToStatement(statementEntry)),
      }
    }),
  })
})


export const createStatement = wrapAsyncMiddleware(async function createStatement(req, res) {
  // Create a new statement.
  let show = req.query.show || []
  let statement = req.body
  let statementType = statement.type

  if (["Argument", "Card", "PlainStatement", "Property"].includes(statementType)) {
    delete statement.abuseId
    delete statement.isAbuse
  }
  if (["PlainStatement", "Tag"].includes(statementType)) {
    statement.name = statement.name.replace(/[\n\r]+/g," ").replace(/\s+/g," ").trim()
    if (statement.name.length === 0) {
      res.status(400)
      res.json({
        apiVersion: "1",
        code: 400,  // Bad Request
        message: "Missing or empty name in statement.",
      })
      return
    }
  }
  if (statementType === "PlainStatement") {
    statement.authorId = req.authenticatedUser.id
  }
  delete statement.createdAt
  delete statement.deleted
  delete statement.id
  delete statement.rating
  delete statement.ratingCount
  delete statement.ratingSum
  delete statement.type

  let hash = hashStatement(statementType, statement)
  let existingStatement = entryToStatement(await db.oneOrNone("SELECT * FROM statements WHERE hash = $1", hash))
  if (existingStatement === null) {
    let result = await db.one(
      `INSERT INTO statements(created_at, hash, type, data)
        VALUES (current_timestamp, $1, $2, $3)
        RETURNING created_at, id, rating, rating_count, rating_sum`,
      [hash, statementType, statement],
    )
    Object.assign(statement, {
      createdAt: result.created_at,
      id: result.id,
      rating: result.rating,
      ratingCount: result.rating_count,
      ratingSum: result.rating_sum,
      type: statementType,
    })
    await generateObjectTextSearch(statement)
  } else {
    statement = existingStatement
  }
  let [oldBallot, ballot] = await rateStatement(statement.id, req.authenticatedUser.id, 1)

  // Optimistic optimizations
  const statements = []
  const oldRating = statement.rating
  const oldRatingSum = statement.ratingSum
  statements.push(statement)
  if (oldBallot === null) statement.ratingCount += 1
  statement.ratingSum += ballot.rating - (oldBallot === null ? 0 : oldBallot.rating)
  statement.ratingSum = Math.max(-statement.ratingCount, Math.min(statement.ratingCount, statement.ratingSum))
  statement.rating = statement.ratingSum / statement.ratingCount
  await propagateOptimisticOptimization(statements, statement, oldRating, oldRatingSum)

  if (existingStatement === null) res.status(201)  // Created
  res.json({
    apiVersion: "1",
    data: await toStatementData(statement, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showAbuse: show.includes("abuse"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showTags: show.includes("tags"),
      statements,
    }),
  })
})


export const deleteStatement = wrapAsyncMiddleware(async function deleteStatement(req, res) {
  // Delete an existing statement.
  let show = req.query.show || []
  let statement = req.statement

  // TODO: Instead of deleting statement, add a vote to flag it (using a given reason)?

  statement.deleted = true
  const data = await toStatementData(statement, req.authenticatedUser, {
    depth: req.query.depth || 0,
    showAbuse: show.includes("abuse"),
    showAuthor: show.includes("author"),
    showBallot: show.includes("ballot"),
    showGrounds: show.includes("grounds"),
    showProperties: show.includes("properties"),
    showReferences: show.includes("references"),
    showTags: show.includes("tags"),
  })
  // TODO: If delete is kept, also remove all other linked statements (grounds, tags, abuse, etc).
  await db.none("DELETE FROM statements WHERE id = $<id>", statement)
  res.json({
    apiVersion: "1",
    data: data,
  })
})


export const getStatement = wrapAsyncMiddleware(async function getStatement(req, res) {
  // Respond an existing statement.

  let show = req.query.show || []
  res.json({
    apiVersion: "1",
    data: await toStatementData(req.statement,  req.authenticatedUser, {
      depth: req.query.depth || 0,
      showAbuse: show.includes("abuse"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showTags: show.includes("tags"),
    }),
  })
})


export const listStatements = wrapAsyncMiddleware(async function listStatements(req, res) {
  // Respond a list of statements.
  let authenticatedUser = req.authenticatedUser
  let language = req.query.language
  let limit = req.query.limit || 20
  let offset = req.query.offset || 0
  let queryTypes = req.query.type || []
  let show = req.query.show || []
  let tagsName = req.query.tag || []
  let term = req.query.term
  let userName = req.query.user  // email or urlName

  let user = null
  if (userName) {
    if (!authenticatedUser) {
      res.status(401)  // Unauthorized
      res.json({
        apiVersion: "1",
        code: 401,  // Unauthorized
        message: "The statements of a user can only be retrieved by the user himself or an admin.",
      })
      return
    }

    if (userName.indexOf("@") >= 0) {
      user = entryToUser(await db.oneOrNone(
        `SELECT * FROM objects
          INNER JOIN users ON objects.id = users.id
          WHERE email = $1
        `, userName))
      if (user === null) {
        res.status(404)
        res.json({
          apiVersion: "1",
          code: 404,
          message: `No user with email "${userName}".`,
        })
        return
      }
    } else {
      user = entryToUser(await db.oneOrNone(
        `SELECT * FROM objects
          INNER JOIN users ON objects.id = users.id
          WHERE url_name = $1
        `, userName))
      if (user === null) {
        res.status(404)
        res.json({
          apiVersion: "1",
          code: 404,
          message: `No user named "${userName}".`,
        })
        return
      }
    }

    if (!ownsUser(authenticatedUser, user)) {
      res.status(403)  // Forbidden
      res.json({
        apiVersion: "1",
        code: 403,  // Forbidden
        message: "The statements of a user can only be retrieved by the user himself or an admin.",
      })
      return
    }
  }

  let whereClauses = []

  if (language) {
    whereClauses.push("data->>'language' = $<language> OR data->'language' IS NULL")
  }

  if (tagsName.length > 0) {
    whereClauses.push("data->'tags' @> $<tagsName>")
  }

  if (term) {
    term = term.trim()
    if (term) {
      let languages = language ? [language] : config.languages
      let termClauses = languages.map( language =>
        `id IN (
          SELECT statement_id
            FROM statements_text_search
            WHERE text_search @@ plainto_tsquery('${languageConfigurationNameByCode[language]}', $<term>)
            AND configuration_name = '${languageConfigurationNameByCode[language]}'
        )`
      )
      if (termClauses.length === 1) {
        whereClauses.push(termClauses[0])
      } else if (termClauses.length > 1) {
        let termClause = termClauses.join(" OR ")
        whereClauses.push(`(${termClause})`)
      }
    }
  }

  let cardTypes = []
  let statementTypes = []
  for (let type of queryTypes) {
    if (types.includes(type)) statementTypes.push(type)
    else cardTypes.push(type)
  }
  if (cardTypes.length > 0) {
    whereClauses.push("data->'values'->'Card Type' ?| array[$<cardTypes:csv>]")
  }
  if (statementTypes.length > 0) {
    whereClauses.push("type IN ($<statementTypes:csv>)")
  }

  if (user !== null) {
    whereClauses.push("id IN (SELECT statement_id FROM ballots WHERE voter_id = $<userId>)")
  }

  let whereClause = whereClauses.length === 0 ? "" : "WHERE " + whereClauses.join(" AND ")

  let coreArguments = {
      cardTypes,
      language,
      statementTypes,
      tagsName,
      term,
      userId: user === null ? null : user.id,
    }
  let count = (await db.one(`SELECT count(*) as count FROM statements ${whereClause}`, coreArguments)).count

  let statements = (await db.any(
    `SELECT * FROM statements ${whereClause} ORDER BY created_at DESC LIMIT $<limit> OFFSET $<offset>`,
    {
      ...coreArguments,
      limit,
      offset,
    },
  )).map(entryToStatement)

  res.json({
    apiVersion: "1",
    count: count,
    data: await toStatementsData(statements, req.authenticatedUser, {
      depth: req.query.depth || 0,
      showAbuse: show.includes("abuse"),
      showAuthor: show.includes("author"),
      showBallot: show.includes("ballot"),
      showGrounds: show.includes("grounds"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showTags: show.includes("tags"),
    }),
    limit: limit,
    offset: offset,
  })
})


export const requireStatement = wrapAsyncMiddleware(async function requireStatement(req, res, next) {
  let id = req.params.statementId
  let statement = entryToStatement(await db.oneOrNone("SELECT * FROM statements WHERE id = $1", id))
  if (statement === null) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No statement with ID "${id}".`,
    })
    return
  }
  req.statement = statement

  return next()
})
