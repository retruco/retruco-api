// Retruco-API -- HTTP API to bring out shared positions from argumented statements
// By: Paula Forteza <paula@retruco.org>
//     Emmanuel Raviart <emmanuel@retruco.org>
//
// Copyright (C) 2016, 2017 Paula Forteza & Emmanuel Raviart
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
import { pbkdf2Sync, randomBytes } from "crypto"
import slugify from "slug"

import config from "../config"
import { db } from "../database"
import { entryToUser, getObjectFromId, ownsUser, toUserJson, wrapAsyncMiddleware } from "../model"

export const activatorUser = {
  find: function(id, callback) {
    db
      .oneOrNone(
        `
        SELECT * FROM objects
        INNER JOIN users ON objects.id = users.id
        WHERE objects.id = $1
      `,
        id,
      )
      .then(function(user) {
        callback(null, entryToUser(user))
      })
      .catch(function(error) {
        console.log(`Exception in activatorUser.find(${id}): `, error.stack || error)
        callback(String(error))
      })
  },
  activate: function(id, callback) {
    db
      .none("UPDATE users SET activated = TRUE WHERE id = $1", id)
      .then(function() {
        callback(null)
      })
      .catch(function(error) {
        console.log(`Exception in activatorUser.activate(${id}): `, error.stack || error)
        callback(String(error))
      })
  },
  setPassword: function(id, password, callback) {
    // See http://security.stackexchange.com/a/27971 for explaination of digest and salt size.
    let salt = randomBytes(16).toString("base64").replace(/=/g, "")
    let passwordDigest = pbkdf2Sync(password, salt, 4096, 16, "sha512").toString("base64").replace(/=/g, "")
    db
      .none("UPDATE users SET activated = TRUE, password_digest = $<passwordDigest>, salt = $<salt> WHERE id = $<id>", {
        id,
        passwordDigest,
        salt,
      })
      .then(function() {
        callback(null, null)
      })
      .catch(function(error) {
        console.log(`Exception in activatorUser.setPassword(${id}): `, error.stack || error)
        callback(String(error))
      })
  },
}

export function authenticate(require) {
  return wrapAsyncMiddleware(async function authenticate(req, res, next) {
    let credentials = basicAuth(req)
    let user
    if (credentials) {
      let userName = credentials.name // email or urlName
      if (userName.indexOf("@") >= 0) {
        user = entryToUser(
          await db.oneOrNone(
            `SELECT * FROM objects
            INNER JOIN users ON objects.id = users.id
            WHERE email = $1
          `,
            userName,
          ),
        )
        if (user === null) {
          res.status(401) // Unauthorized
          res.json({
            apiVersion: "1",
            code: 401, // Unauthorized
            message: `No user with email "${userName}".`,
          })
          return
        }
      } else {
        let urlName = slugify(userName, { mode: "rfc3986" })
        user = entryToUser(
          await db.oneOrNone(
            `SELECT * FROM objects
            INNER JOIN users ON objects.id = users.id
            WHERE url_name = $1
          `,
            urlName,
          ),
        )
        if (user === null) {
          res.status(401) // Unauthorized
          res.json({
            apiVersion: "1",
            code: 401, // Unauthorized
            message: `No user with name "${urlName}".`,
          })
          return
        }
      }
      let passwordDigest = pbkdf2Sync(credentials.pass, user.salt, 4096, 16, "sha512")
        .toString("base64")
        .replace(/=/g, "")
      if (passwordDigest != user.passwordDigest) {
        res.status(401) // Unauthorized
        res.set("WWW-Authenticate", `Basic realm="${config.title}"`)
        res.json({
          apiVersion: "1",
          code: 401, // Unauthorized
          message: `Invalid password for user "${userName}".`,
        })
        return
      }
    }

    let apiKey = req.get("retruco-api-key")
    if (apiKey) {
      if (credentials) {
        res.status(401) // Unauthorized
        res.json({
          apiVersion: "1",
          code: 401, // Unauthorized
          message: "HTTP Basic Authentication and retruco-api-key headers must not be used together." +
            " Use only one authentication method.",
        })
        return
      }
      user = entryToUser(
        await db.oneOrNone(
          `SELECT * FROM objects
          INNER JOIN users ON objects.id = users.id
          WHERE api_key = $1
        `,
          apiKey,
        ),
      )
      if (user === null) {
        res.status(401) // Unauthorized
        res.json({
          apiVersion: "1",
          code: 401, // Unauthorized
          message: `No user with apiKey "${apiKey}".`,
        })
        return
      }
    }

    if (user) {
      req.authenticatedUser = user
    } else if (require) {
      res.status(401) // Unauthorized
      res.json({
        apiVersion: "1",
        code: 401, // Unauthorized
        message: "Authentication is required.",
      })
      return
    }
    return next()
  })
}

export function completeActivateAfterActivator(req, res) {
  res.status(req.activator.code)
  if (req.activator.code === 200) {
    db
      .oneOrNone(
        `
        SELECT * FROM objects
        INNER JOIN users ON objects.id = users.id
        WHERE objects.id = $1
      `,
        req.params.user,
      )
      .then(function(user) {
        res.json({
          apiVersion: "1",
          data: toUserJson(entryToUser(user), { showApiKey: true, showEmail: true }),
        })
      })
      .catch(function(error) {
        console.log("Exception in completeActivateAfterActivator:", error.stack || error)
        res.status(500)
        res.json({
          apiVersion: "1",
          message: `An unexpected error occurred after completing user activation: ${req.activator.message}`,
        })
      })
  } else {
    console.log("An error occurred while completing user activation:", req.activator.message)
    if (typeof req.activator.message === "string") {
      res.json({
        apiVersion: "1",
        message: `An error occurred while completing user activation: ${req.activator.message}`,
      })
    } else {
      res.json({
        apiVersion: "1",
        errors: req.activator.message,
        message: "An error occurred while completing user activation.",
      })
    }
  }
}

export const completeResetPasswordAfterActivator = wrapAsyncMiddleware(
  async function completeResetPasswordAfterActivator(req, res) {
    let userId = req.params.user
    // let userInfos = req.body  // Contains only password.
    res.status(req.activator.code)
    if (req.activator.code === 200) {
      res.json({
        apiVersion: "1",
        data: toUserJson(await getObjectFromId(userId), { showApiKey: true, showEmail: true }),
      })
    } else {
      console.log("An error occurred while completing user activation:", req.activator.message)
      if (typeof req.activator.message === "string") {
        res.json({
          apiVersion: "1",
          message: `An error occurred while completing user activation: ${req.activator.message}`,
        })
      } else {
        res.json({
          apiVersion: "1",
          errors: req.activator.message,
          message: "An error occurred while completing user activation.",
        })
      }
    }
  },
)

export const createUser = wrapAsyncMiddleware(async function createUser(req, res, next) {
  // Create a new user.
  let user = req.body
  delete user.createdAt
  delete user.id
  delete user.isAdmin
  if (!user.name) user.name = user.urlName
  user.urlName = slugify(user.urlName, { mode: "rfc3986" })

  if ((await db.one("SELECT EXISTS (SELECT 1 FROM users WHERE email = $1)", user.email)).exists) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400, // Bad Request
      errors: { email: "Email already exists" },
      message: "An user with the same email address already exists.",
    })
    return
  }
  if ((await db.one("SELECT EXISTS (SELECT 1 FROM users WHERE url_name = $1)", user.urlName)).exists) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400, // Bad Request
      errors: { email: "Username already exists" },
      message: "An user with the same name already exists.",
    })
    return
  }

  if (user.password) {
    user.apiKey = randomBytes(16).toString("base64").replace(/=/g, "") // 128 bits API key
    // See http://security.stackexchange.com/a/27971 for explaination of digest and salt size.
    user.salt = randomBytes(16).toString("base64").replace(/=/g, "")
    user.passwordDigest = pbkdf2Sync(user.password, user.salt, 4096, 16, "sha512").toString("base64").replace(/=/g, "")
    delete user.password
  }

  let result = await db.one(
    `INSERT INTO objects(created_at, type)
      VALUES (current_timestamp, 'User')
      RETURNING created_at, id`,
    user,
  )
  user.createdAt = result.created_at
  user.id = result.id
  result = await db.one(
    `INSERT INTO users(api_key, email, id, name, password_digest, salt, url_name)
      VALUES ($<apiKey>, $<email>, $<id>, $<name>, $<passwordDigest>, $<salt>, $<urlName>)
      RETURNING activated, is_admin`,
    user,
  )
  user.activated = result.activated
  user.isAdmin = result.is_admin

  // res.status(201)  // Created
  // res.json({
  //   apiVersion: "1",
  //   data: toUserJson(user, {showApiKey: true, showEmail: true}),
  // })

  req.activator = {
    body: {
      apiVersion: "1",
      data: toUserJson(user, { showApiKey: true, showEmail: true }),
    },
    id: user.id,
  }
  next()
})

export function createUserAfterActivator(req, res) {
  res.status(req.activator.code)
  if (req.activator.code === 201) {
    res.json(req.activator.message)
  } else {
    console.log("An error occurred while sending an activation email to user:", req.activator.message)
    if (typeof req.activator.message === "string") {
      res.json({
        apiVersion: "1",
        message: `An error occurred while sending an activation email to user: ${req.activator.message}`,
      })
    } else {
      res.json({
        apiVersion: "1",
        errors: req.activator.message,
        message: "An error occurred while sending an activation email to user.",
      })
    }
  }
}

export const deleteUser = wrapAsyncMiddleware(async function deleteUser(req, res) {
  // Delete an existing user.
  let authenticatedUser = req.authenticatedUser
  let user = req.user
  if (!ownsUser(authenticatedUser, user)) {
    res.status(403) // Forbidden
    res.json({
      apiVersion: "1",
      code: 403, // Forbidden
      message: "A user can only be deleted by himself or an admin.",
    })
    return
  }
  // TODO: Keep user ballots, before deleting objet to notify statements to recalculate their ratings.
  await db.none("DELETE FROM objects WHERE id = $<id>", user)
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
    res.status(403) // Forbidden
    res.json({
      apiVersion: "1",
      code: 403, // Forbidden
      message: "Attributes apiKey or email can only be retrieved by user or an admin.",
    })
    return
  }
  res.json({
    apiVersion: "1",
    data: toUserJson(user, { showApiKey, showEmail }),
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
    user = entryToUser(
      await db.oneOrNone(
        `SELECT * FROM objects
        INNER JOIN users ON objects.id = users.id
        WHERE email = $1
      `,
        userName,
      ),
    )
    if (user === null) {
      res.status(401) // Unauthorized
      res.json({
        apiVersion: "1",
        code: 401, // Unauthorized
        message: `No user with email "${userName}".`,
      })
      return
    }
  } else {
    let urlName = slugify(userName, { mode: "rfc3986" })
    user = entryToUser(
      await db.oneOrNone(
        `SELECT * FROM objects
        INNER JOIN users ON objects.id = users.id
        WHERE url_name = $1
      `,
        urlName,
      ),
    )
    if (user === null) {
      res.status(401) // Unauthorized
      res.json({
        apiVersion: "1",
        code: 401, // Unauthorized
        message: `No user with name "${urlName}".`,
      })
      return
    }
  }
  let passwordDigest = pbkdf2Sync(password, user.salt, 4096, 16, "sha512").toString("base64").replace(/=/g, "")
  if (passwordDigest != user.passwordDigest) {
    res.status(401) // Unauthorized
    res.json({
      apiVersion: "1",
      code: 401, // Unauthorized
      message: `Invalid password for user "${userName}".`,
    })
    return
  }
  res.json({
    apiVersion: "1",
    data: toUserJson(user, { showApiKey: true, showEmail: true }),
  })
})

export const requireUser = wrapAsyncMiddleware(async function requireUser(req, res, next) {
  let userName = req.params.userName // email or urlName

  let user
  if (userName.indexOf("@") >= 0) {
    user = entryToUser(
      await db.oneOrNone(
        `SELECT * FROM objects
        INNER JOIN users ON objects.id = users.id
        WHERE email = $1
      `,
        userName,
      ),
    )
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
    let urlName = slugify(userName, { mode: "rfc3986" })
    user = entryToUser(
      await db.oneOrNone(
        `SELECT * FROM objects
        INNER JOIN users ON objects.id = users.id
        WHERE url_name = $1
      `,
        urlName,
      ),
    )
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

export const resetPassword = wrapAsyncMiddleware(async function resetPassword(req, res, next) {
  let userInfos = req.body // contains only email attribute.

  let user = entryToUser(
    await db.oneOrNone(
      `SELECT * FROM objects
      INNER JOIN users ON objects.id = users.id
      WHERE email = $<email>
    `,
      userInfos,
    ),
  )
  if (user === null) {
    res.status(404)
    res.json({
      apiVersion: "1",
      code: 404,
      message: `No user with email "${userInfos.email}".`,
    })
    return
  }

  // Call Activator.
  req.params.user = user.id
  return next()
})

export function resetPasswordAfterActivator(req, res) {
  if (req.activator.code === 201) {
    // User was already existing. So replace status code with a 200.
    res.status(200)
    res.json({
      apiVersion: "1",
      data: "A message containing the instructions to reset password has been sent to user.",
    })
  } else {
    res.status(req.activator.code)
    console.log("An error occurred while sending reset password instructions to user:", req.activator.message)
    if (typeof req.activator.message === "string") {
      res.json({
        apiVersion: "1",
        message: `An error occurred while sending reset password instructions to user: ${req.activator.message}`,
      })
    } else {
      res.json({
        apiVersion: "1",
        errors: req.activator.message,
        message: "An error occurred while sending reset password instructions to user.",
      })
    }
  }
}

export const sendActivation = wrapAsyncMiddleware(async function sendActivation(req, res, next) {
  // Create a new user.
  let user = req.user
  if (user.activated) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400, // Bad Request
      message: "User is already activated.",
    })
    return
  }
  req.activator = {
    body: {
      apiVersion: "1",
      data: toUserJson(user, { showApiKey: true, showEmail: true }),
    },
    id: user.id,
  }
  next()
})

export function sendActivationAfterActivator(req, res) {
  if (req.activator.code === 201) {
    // User was already existing. So replace status code with a 200.
    res.status(200)
    res.json(req.activator.message)
  } else {
    res.status(req.activator.code)
    console.log("An error occurred while sending an activation email to user:", req.activator.message)
    if (typeof req.activator.message === "string") {
      res.json({
        apiVersion: "1",
        message: `An error occurred while sending an activation email to user: ${req.activator.message}`,
      })
    } else {
      res.json({
        apiVersion: "1",
        errors: req.activator.message,
        message: "An error occurred while sending an activation email to user.",
      })
    }
  }
}
