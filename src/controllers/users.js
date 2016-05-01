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


import basicAuth from "basic-auth"
import {pbkdf2, randomBytes} from "mz/crypto"

import config from "../config"
import {r} from "../database"
import {ownsUser} from "../model"


export function authenticate(require) {
  return async function authenticate(ctx, next) {
    let user

    let credentials = basicAuth(ctx.request)
    if (credentials) {
      let urlName = credentials.name
      let users = await r
        .table("users")
        .getAll(urlName, {index: "urlName"})
        .limit(1)
      if (users.length < 1) {
        ctx.status = 401  // Unauthorized
        ctx.set("WWW-Authenticate", `Basic realm="${config.title}"`)
        ctx.body = {
          apiVersion: "1",
          code: 401,  // Unauthorized
          message: `No user with name "${urlName}".`,
        }
        return
      }
      user = users[0]
      let passwordDigest = (await pbkdf2(credentials.pass, user.salt, 4096, 16, "sha512")).toString("base64")
        .replace(/=/g, "")
      if (passwordDigest != user.passwordDigest) {
        ctx.status = 401  // Unauthorized
        ctx.set("WWW-Authenticate", `Basic realm="${config.title}"`)
        ctx.body = {
          apiVersion: "1",
          code: 401,  // Unauthorized
          message: `Invalid password for user "${urlName}".`,
        }
        return
      }
    }

    let apiKey = ctx.get("Retruco-API-api-key")
    if (apiKey) {
      if (credentials) {
        ctx.status = 401  // Unauthorized
        ctx.body = {
          apiVersion: "1",
          code: 401,  // Unauthorized
          message: "HTTP Basic Authentication and Retruco-API-API-Key headers must not be used together." +
            " Use only one authentication method.",
        }
        return
      }
      let users = await r
        .table("users")
        .getAll(apiKey, {index: "apiKey"})
        .limit(1)
      if (users.length < 1) {
        ctx.status = 401  // Unauthorized
        ctx.body = {
          apiVersion: "1",
          code: 401,  // Unauthorized
          message: `No user with apiKey "${apiKey}".`,
        }
        return
      }
      user = users[0]
    }

    if (user) {
      ctx.authenticatedUser = user
    } else if (require) {
      ctx.status = 401  // Unauthorized
      ctx.body = {
        apiVersion: "1",
        code: 401,  // Unauthorized
        message: "Authentication is required.",
      }
      return
    }
    await next()
  }
}


export {create}
async function create(ctx) {
  // Create a new user.
  let user = ctx.parameter.user
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
  ctx.status = 201  // Created
  ctx.body = {
    apiVersion: "1",
    data: await toUserJson(user, {showApiKey: true}),
  }
}


export {del}
async function del(ctx) {
  // Delete an existing user.
  let authenticatedUser = ctx.authenticatedUser
  let user = ctx.user
  if (!ownsUser(authenticatedUser, user)) {
    ctx.status = 403  // Forbidden
    ctx.body = {
      apiVersion: "1",
      code: 403,  // Forbidden
      message: "A user can only be deleted by himself or an admin.",
    }
    return
  }
  // TODO: Delete user statements, etc?
  await r
    .table("users")
    .get(user.id)
    .delete()
  ctx.body = {
    apiVersion: "1",
    data: await toUserJson(user),
  }
}


export {get}
async function get(ctx) {
  // Respond an existing user.
  let authenticatedUser = ctx.authenticatedUser
  let show = ctx.parameter.show || []
  let showApiKey = show.includes("apiKey")
  let user = ctx.user
  if (showApiKey && !ownsUser(authenticatedUser, user)) {
    ctx.status = 403  // Forbidden
    ctx.body = {
      apiVersion: "1",
      code: 403,  // Forbidden
      message: "User's apiKey can only be viewed by himself or an admin.",
    }
    return
  }
  ctx.body = {
    apiVersion: "1",
    data: await toUserJson(user, {showApiKey}),
  }
}


// export {list}
// async function list(ctx) {
//   // Respond a list of all users.
//   let users = await r
//     .table("users")
//     .orderBy({index: r.desc("createdAt")})
//   ctx.body = {
//     apiVersion: "1",
//     data: users,
//   }
// }


export {listUrlNames}
async function listUrlNames(ctx) {
  // Respond a list of the urlNames of all users.
  let usersUrlName = await r
    .table("users")
    .orderBy({index: r.desc("createdAt")})
    .getField("urlName")
  ctx.body = {
    apiVersion: "1",
    data: usersUrlName,
  }
}


export {login}
async function login(ctx) {
  // Log user in.
  let user = ctx.parameter.user
  let password = user.password
  let urlName = user.userName
  let users = await r
    .table("users")
    .getAll(urlName, {index: "urlName"})
    .limit(1)
  if (users.length < 1) {
    ctx.status = 401  // Unauthorized
    ctx.body = {
      apiVersion: "1",
      code: 401,  // Unauthorized
      message: `No user with name "${urlName}".`,
    }
    return
  }
  user = users[0]
  let passwordDigest = (await pbkdf2(password, user.salt, 4096, 16, "sha512")).toString("base64").replace(/=/g, "")
  if (passwordDigest != user.passwordDigest) {
    ctx.status = 401  // Unauthorized
    ctx.body = {
      apiVersion: "1",
      code: 401,  // Unauthorized
      message: `Invalid password for user "${urlName}".`,
    }
    return
  }
  ctx.body = {
    apiVersion: "1",
    data: await toUserJson(user, {showApiKey: true}),
  }
}


export {requireUser}
async function requireUser(ctx, next) {
  let urlName = ctx.parameter.userName
  let users = await r
    .table("users")
    .getAll(urlName, {index: "urlName"})
    .limit(1)
  if (users.length < 1) {
    ctx.status = 404
    ctx.body = {
      apiVersion: "1",
      code: 404,
      message: `No user named "${urlName}".`,
    }
    return
  }
  ctx.user = users[0]

  await next()
}


async function toUserJson(user, {showApiKey = false} = {}) {
  let userJson = {...user}
  if (!showApiKey) delete userJson.apiKey
  userJson.createdAt = userJson.createdAt.toISOString()
  delete userJson.id
  delete userJson.passwordDigest
  delete userJson.salt
  return userJson
}


// export {update}
// async function update(ctx) {
//   // Update an existing user.
//   let user = ctx.parameter.user
//   if (user === null || user.id === null) throw new Error('User must have an "id" field.')
//   delete user.createdAt
//   let result = await r
//     .table("users")
//     .get(user.id)
//     .update(user, {returnChanges: true})
//   user = result.changes[0].new_val
//   ctx.body = {
//     apiVersion: "1",
//     data: user,
//   }
// }
