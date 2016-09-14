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

import config from "../config"
import {r} from "../database"
import {ownsUser, toUserJson, wrapAsyncMiddleware} from "../model"


export function authenticate(require) {
  return wrapAsyncMiddleware(async function authenticate(req, res, next) {
    let user

    let credentials = basicAuth(req)
    if (credentials) {
      let userName = credentials.name  // email or urlName
      if (userName.indexOf("@") >= 0) {
        let users = await r
          .table("users")
          .getAll(userName, {index: "email"})
          .limit(1)
        if (users.length < 1) {
          res.status(401)  // Unauthorized
          res.set("WWW-Authenticate", `Basic realm="${config.title}"`)
          res.json({
            apiVersion: "1",
            code: 401,  // Unauthorized
            message: `No user with email "${userName}".`,
          })
          return
        }
        user = users[0]
      } else {
        let users = await r
          .table("users")
          .getAll(name, {index: "urlName"})
          .limit(1)
        if (users.length < 1) {
          res.status(401)  // Unauthorized
          res.set("WWW-Authenticate", `Basic realm="${config.title}"`)
          res.json({
            apiVersion: "1",
            code: 401,  // Unauthorized
            message: `No user with name "${userName}".`,
          })
          return
        }
        user = users[0]
      }
      let passwordDigest = (await pbkdf2(credentials.pass, user.salt, 4096, 16, "sha512")).toString("base64")
        .replace(/=/g, "")
      if (passwordDigest != user.passwordDigest) {
        res.status(401)  // Unauthorized
        res.set("WWW-Authenticate", `Basic realm="${config.title}"`)
        res.json({
          apiVersion: "1",
          code: 401,  // Unauthorized
          message: `Invalid password for user "${name}".`,
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
      let users = await r
        .table("users")
        .getAll(apiKey, {index: "apiKey"})
        .limit(1)
      if (users.length < 1) {
        res.status(401)  // Unauthorized
        res.json({
          apiVersion: "1",
          code: 401,  // Unauthorized
          message: `No user with apiKey "${apiKey}".`,
        })
        return
      }
      user = users[0]
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

export const createUser = wrapAsyncMiddleware(async function createUser(req, res, next) {
  // Create a new user.
  let user = req.body
  user.createdAt = r.now()
  delete user.id
  if (!user.name) user.name = user.urlName
  if (user.password) {
    user.apiKey = (await randomBytes(16)).toString("base64").replace(/=/g, "")  // 128 bits API key
    // See http://security.stackexchange.com/a/27971 for explaination of digest and salt size.
    user.salt = (await randomBytes(16)).toString("base64").replace(/=/g, "")
    user.passwordDigest = (await pbkdf2(user.password, user.salt, 4096, 16, "sha512")).toString("base64")
      .replace(/=/g, "")
    delete user.password
  }

  let result = await r
    .table("users")
    .insert(user, {returnChanges: true})
  user = result.changes[0].new_val
  res.status(201)  // Created
  res.json({
    apiVersion: "1",
    data: toUserJson(user, {showApiKey: true, showEmail: true}),
  })
})


export const deleteUser = wrapAsyncMiddleware(async function deleteUser(req, res, next) {
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
  // TODO: Delete user statements, etc?
  await r
    .table("users")
    .get(user.id)
    .delete()
  res.json({
    apiVersion: "1",
    data: toUserJson(user),
  })
})


export const getUser = wrapAsyncMiddleware(async function getUser(req, res, next) {
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


// export const listUsers = wrapAsyncMiddleware(async function listUsers(req, res, next) {
//   // Respond a list of all users.
//   let users = await r
//     .table("users")
//     .orderBy({index: r.desc("createdAt")})
//   res.json({
//     apiVersion: "1",
//     data: users,
//   }
// })


export const listUsersUrlName = wrapAsyncMiddleware(async function listUsersUrlName(req, res, next) {
  // Respond a list of the urlNames of all users.
  let usersUrlName = await r
    .table("users")
    .orderBy({index: r.desc("createdAt")})
    .getField("urlName")
  res.json({
    apiVersion: "1",
    data: usersUrlName,
  })
})


export const login = wrapAsyncMiddleware(async function login(req, res, next) {
  // Log user in.
  let user = req.body
  let password = user.password
  let urlName = user.userName
  if (urlName.indexOf("@") >= 0) {
    let users = await r
      .table("users")
      .getAll(urlName, {index: "email"})
      .limit(1)
    if (users.length < 1) {
      res.status(401)  // Unauthorized
      res.json({
        apiVersion: "1",
        code: 401,  // Unauthorized
        message: `No user with email "${urlName}".`,
      })
      return
    }
    user = users[0]
  } else {
    let users = await r
      .table("users")
      .getAll(urlName, {index: "urlName"})
      .limit(1)
    if (users.length < 1) {
      res.status(401)  // Unauthorized
      res.json({
        apiVersion: "1",
        code: 401,  // Unauthorized
        message: `No user with name "${urlName}".`,
      })
      return
    }
    user = users[0]
  }
  let passwordDigest = (await pbkdf2(password, user.salt, 4096, 16, "sha512")).toString("base64").replace(/=/g, "")
  if (passwordDigest != user.passwordDigest) {
    res.status(401)  // Unauthorized
    res.json({
      apiVersion: "1",
      code: 401,  // Unauthorized
      message: `Invalid password for user "${urlName}".`,
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
    let users = await r
      .table("users")
      .getAll(userName, {index: "email"})
      .limit(1)
    if (users.length < 1) {
      res.status(404)
      res.json({
        apiVersion: "1",
        code: 404,
        message: `No user with email "${userName}".`,
      })
      return
    }
    user = users[0]
  } else {
    let users = await r
      .table("users")
      .getAll(userName, {index: "urlName"})
      .limit(1)
    if (users.length < 1) {
      res.status(404)
      res.json({
        apiVersion: "1",
        code: 404,
        message: `No user named "${userName}".`,
      })
      return
    }
    user = users[0]
  }
  req.user = user

  return next()
})


// export const updateUser = wrapAsyncMiddleware(async function updateUser(req, res, next) {
//   // Update an existing user.
//   let user = req.body
//   if (user === null || user.id === null) throw new Error('User must have an "id" field.')
//   delete user.createdAt
//   let result = await r
//     .table("users")
//     .get(user.id)
//     .update(user, {returnChanges: true})
//   user = result.changes[0].new_val
//   res.json({
//     apiVersion: "1",
//     data: user,
//   })
// })
