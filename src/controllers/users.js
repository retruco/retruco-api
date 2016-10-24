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


import basicAuth from "basic-auth"
import {pbkdf2, randomBytes} from "mz/crypto"
import slugify from "slug"

import config from "../config"
import {db, entryToUser} from "../database"
import {ownsUser, toUserJson, wrapAsyncMiddleware} from "../model"


export function authenticate(require) {
  return wrapAsyncMiddleware(async function authenticate(req, res, next) {
    let credentials = basicAuth(req)
    let user
    if (credentials) {
      let userName = credentials.name  // email or urlName
      if (userName.indexOf("@") >= 0) {
        user = entryToUser(await db.oneOrNone("SELECT * FROM users WHERE email = $1", userName))
        if (user === null) {
          res.status(401)  // Unauthorized
          res.json({
            apiVersion: "1",
            code: 401,  // Unauthorized
            message: `No user with email "${userName}".`,
          })
          return
        }
      } else {
        let urlName = slugify(userName, {mode: "rfc3986"})
        user = entryToUser(await db.oneOrNone("SELECT * FROM users WHERE url_name = $1", urlName))
        if (user === null) {
          res.status(401)  // Unauthorized
          res.json({
            apiVersion: "1",
            code: 401,  // Unauthorized
            message: `No user with name "${urlName}".`,
          })
          return
        }
      }
      let passwordDigest = (await pbkdf2(credentials.pass, user.salt, 4096, 16, "sha512")).toString("base64")
        .replace(/=/g, "")
      if (passwordDigest != user.passwordDigest) {
        res.status(401)  // Unauthorized
        res.set("WWW-Authenticate", `Basic realm="${config.title}"`)
        res.json({
          apiVersion: "1",
          code: 401,  // Unauthorized
          message: `Invalid password for user "${userName}".`,
        })
        return
      }
    }

    let apiKey = req.get("retruco-api-key")
    if (apiKey) {
      if (credentials) {
        res.status(401)  // Unauthorized
        res.json({
          apiVersion: "1",
          code: 401,  // Unauthorized
          message: "HTTP Basic Authentication and retruco-api-key headers must not be used together." +
            " Use only one authentication method.",
        })
        return
      }
      user = entryToUser(await db.oneOrNone("SELECT * FROM users WHERE api_key = $1", apiKey))
      if (user === null) {
        res.status(401)  // Unauthorized
        res.json({
          apiVersion: "1",
          code: 401,  // Unauthorized
          message: `No user with apiKey "${apiKey}".`,
        })
        return
      }
    }

    if (user) {
      req.authenticatedUser = user
    } else if (require) {
      res.status(401)  // Unauthorized
      res.json({
        apiVersion: "1",
        code: 401,  // Unauthorized
        message: "Authentication is required.",
      })
      return
    }
    return next()
  })
}

export const createUser = wrapAsyncMiddleware(async function createUser(req, res) {
  // Create a new user.
  let user = req.body
  delete user.createdAt
  delete user.id
  delete user.isAdmin
  if (!user.name) user.name = user.urlName
  user.urlName = slugify(user.urlName, {mode: "rfc3986"})
  if (user.password) {
    user.apiKey = (await randomBytes(16)).toString("base64").replace(/=/g, "")  // 128 bits API key
    // See http://security.stackexchange.com/a/27971 for explaination of digest and salt size.
    user.salt = (await randomBytes(16)).toString("base64").replace(/=/g, "")
    user.passwordDigest = (await pbkdf2(user.password, user.salt, 4096, 16, "sha512")).toString("base64")
      .replace(/=/g, "")
    delete user.password
  }

  let result = await db.one(
    `INSERT INTO users(api_key, created_at, email, name, password_digest, salt, url_name)
      VALUES ($<apiKey>, current_timestamp, $<email>, $<name>, $<passwordDigest>, $<salt>, $<urlName>)
      RETURNING created_at, id, is_admin`,
    user,
  )
  user.createdAt = result.created_at
  user.id = result.id
  user.isAdmin = result.is_admin

  res.status(201)  // Created
  res.json({
    apiVersion: "1",
    data: toUserJson(user, {showApiKey: true, showEmail: true}),
  })
})


export const deleteUser = wrapAsyncMiddleware(async function deleteUser(req, res) {
  // Delete an existing user.
  let authenticatedUser = req.authenticatedUser
  let user = req.user
  if (!ownsUser(authenticatedUser, user)) {
    res.status(403)  // Forbidden
    res.json({
      apiVersion: "1",
      code: 403,  // Forbidden
      message: "A user can only be deleted by himself or an admin.",
    })
    return
  }
  // TODO: Delete user ballots, statements, etc?
  await db.none("DELETE FROM users WHERE id = $<id>", user)
  res.json({
    apiVersion: "1",
    data: toUserJson(user),
  })
})


export const getUser = wrapAsyncMiddleware(async function getUser(req, res) {
  // Respond an existing user.
  let authenticatedUser = req.authenticatedUser
  let show = req.query.show || []
  let showApiKey = show.includes("apiKey")
  let showEmail = show.includes("email")
  let user = req.user
  if ((showApiKey || showEmail) && !ownsUser(authenticatedUser, user)) {
    res.status(403)  // Forbidden
    res.json({
      apiVersion: "1",
      code: 403,  // Forbidden
      message: "Attributes apiKey or email can only be retrieved by user or an admin.",
    })
    return
  }
  res.json({
    apiVersion: "1",
    data: toUserJson(user, {showApiKey, showEmail}),
  })
})


export const listUsersUrlName = wrapAsyncMiddleware(async function listUsersUrlName(req, res) {
  // Respond a list of the urlNames of all users.
  let entries = await db.manyOrNone("SELECT url_name FROM users ORDER BY created_at")
  let usersUrlName = entries.map(entry => entry.url_name)
  res.json({
    apiVersion: "1",
    data: usersUrlName,
  })
})


export const login = wrapAsyncMiddleware(async function login(req, res) {
  // Log user in.
  let user = req.body
  let password = user.password
  let userName = user.userName
  if (userName.indexOf("@") >= 0) {
    user = entryToUser(await db.oneOrNone("SELECT * FROM users WHERE email = $1", userName))
    if (user === null) {
      res.status(401)  // Unauthorized
      res.json({
        apiVersion: "1",
        code: 401,  // Unauthorized
        message: `No user with email "${userName}".`,
      })
      return
    }
  } else {
    let urlName = slugify(userName, {mode: "rfc3986"})
    user = entryToUser(await db.oneOrNone("SELECT * FROM users WHERE url_name = $1", urlName))
    if (user === null) {
      res.status(401)  // Unauthorized
      res.json({
        apiVersion: "1",
        code: 401,  // Unauthorized
        message: `No user with name "${urlName}".`,
      })
      return
    }
  }
  let passwordDigest = (await pbkdf2(password, user.salt, 4096, 16, "sha512")).toString("base64").replace(/=/g, "")
  if (passwordDigest != user.passwordDigest) {
    res.status(401)  // Unauthorized
    res.json({
      apiVersion: "1",
      code: 401,  // Unauthorized
      message: `Invalid password for user "${userName}".`,
    })
    return
  }
  res.json({
    apiVersion: "1",
    data: toUserJson(user, {showApiKey: true, showEmail: true}),
  })
})


export const requireUser = wrapAsyncMiddleware(async function requireUser(req, res, next) {
  let userName = req.params.userName  // email or urlName

  let user
  if (userName.indexOf("@") >= 0) {
    user = entryToUser(await db.oneOrNone("SELECT * FROM users WHERE email = $1", userName))
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
    let urlName = slugify(userName, {mode: "rfc3986"})
    user = entryToUser(await db.oneOrNone("SELECT * FROM users WHERE url_name = $1", urlName))
    if (user === null) {
      res.status(404)
      res.json({
        apiVersion: "1",
        code: 404,
        message: `No user named "${urlName}".`,
      })
      return
    }
  }
  req.user = user

  return next()
})
