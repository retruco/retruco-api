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


import bodyParser from "body-parser"
import express from "express"
import expressWs from "express-ws"
import http from "http"
import swagger from "swagger-express-middleware"

import config from "./config"
import {checkDatabase} from "./database"
import * as abusesController from "./controllers/abuses"
import * as argumentsController from "./controllers/arguments"
import * as ballotsController from "./controllers/ballots"
import * as statementsController from "./controllers/statements"
import * as tagsController from "./controllers/tags"
import * as usersController from "./controllers/users"
import swaggerSpecification from "./swagger"


const app = express()
expressWs(app)

app.set("title", config.title)
app.set("trust proxy", config.proxy)

// Enable Express case-sensitive and strict options.
app.enable("case sensitive routing")
app.enable("strict routing")

app.use(bodyParser.json({limit: "5mb"}))

app.ws("/test", function (ws, req) {
  ws.on("message", function (msg) {
    console.log("Received", msg)
    ws.send(`Ping: ${msg}`)
  })
  console.log("socket", req.testing)
})

const swaggerMiddleware = new swagger.Middleware()
swaggerMiddleware.init(swaggerSpecification, function (/* err */) {
  app.use(swaggerMiddleware.metadata())
  app.use(swaggerMiddleware.CORS())
  app.use(swaggerMiddleware.files({
    apiPath: "/swagger.json",  // Serve the Swagger API from "/swagger.json" instead of "/api-docs/".
    rawFilesPath: false,  // Disable serving the raw Swagger files.
  }))
  app.use(swaggerMiddleware.parseRequest({
    // Configure the cookie parser to use secure cookies.
    cookie: {
      secret: config.keys[0],
    },
    // Don't allow JSON content over 1mb (default is 1mb).
    json: {
      limit: "1mb",
    },
  }))

  // Non Swagger-based API

  app.use(swaggerMiddleware.validateRequest())

  // Swagger-based API

  app.get("/", function (req, res) {
    res.json({
      api: 1,
      title: config.title,
    })
  })

  app.post("/cards", usersController.authenticate(true), statementsController.createCard)
  app.post("/cards/bundle", usersController.authenticate(true), statementsController.bundleCards)

  app.get("/statements", usersController.authenticate(false), statementsController.listStatements)
  app.post("/statements", usersController.authenticate(true), statementsController.createStatement)
  app.get("/statements/autocomplete", statementsController.autocompleteStatements)
  app.delete("/statements/:statementId", usersController.authenticate(true),
    statementsController.requireStatement, statementsController.deleteStatement)
  app.get("/statements/:statementId", usersController.authenticate(false),
    statementsController.requireStatement, statementsController.getStatement)

  app.get("/statements/:statementId/abuse", usersController.authenticate(false),
    statementsController.requireStatement, abusesController.requireAbuse, statementsController.getStatement)
  app.delete("/statements/:statementId/abuse/rating", usersController.authenticate(true),
    statementsController.requireStatement, abusesController.requireAbuse, ballotsController.deleteBallot)
  app.get("/statements/:statementId/abuse/rating", usersController.authenticate(true),
    statementsController.requireStatement, abusesController.requireAbuse, ballotsController.getBallot)
  app.post("/statements/:statementId/abuse/rating", usersController.authenticate(true),
    statementsController.requireStatement, abusesController.requireAbuse, ballotsController.upsertBallot)

  app.get("/statements/:statementId/arguments/:groundId", usersController.authenticate(false),
    statementsController.requireStatement, argumentsController.requireArgument, statementsController.getStatement)
  app.delete("/statements/:statementId/arguments/:groundId/rating",
    usersController.authenticate(true), statementsController.requireStatement, argumentsController.requireArgument,
    ballotsController.deleteBallot)
  app.get("/statements/:statementId/arguments/:groundId/rating", usersController.authenticate(true),
    statementsController.requireStatement, argumentsController.requireArgument, ballotsController.getBallot)
  app.post("/statements/:statementId/arguments/:groundId/rating",
    usersController.authenticate(true), statementsController.requireStatement, argumentsController.requireArgument,
    ballotsController.upsertBallot)

  app.delete("/statements/:statementId/rating", usersController.authenticate(true),
    statementsController.requireStatement, ballotsController.deleteBallot)
  app.get("/statements/:statementId/rating", usersController.authenticate(true),
    statementsController.requireStatement, ballotsController.getBallot)
  app.post("/statements/:statementId/rating", usersController.authenticate(true),
    statementsController.requireStatement, ballotsController.upsertBallot)

  app.get("/statements/:statementId/tags", usersController.authenticate(false),
    statementsController.requireStatement, tagsController.listStatementTags)
  app.get("/statements/:statementId/tags/:tagName", usersController.authenticate(false),
    statementsController.requireStatement, tagsController.requireTag, statementsController.getStatement)
  app.delete("/statements/:statementId/tags/:tagName/rating", usersController.authenticate(true),
    statementsController.requireStatement, tagsController.requireTag, ballotsController.deleteBallot)
  app.get("/statements/:statementId/tags/:tagName/rating", usersController.authenticate(true),
    statementsController.requireStatement, tagsController.requireTag, ballotsController.getBallot)
  app.post("/statements/:statementId/tags/:tagName/rating",
    usersController.authenticate(true), statementsController.requireStatement, tagsController.requireTag,
    ballotsController.upsertBallot)

  app.post("/login", usersController.login)

  app.get("/users", usersController.listUsersUrlName)
  app.post("/users", usersController.createUser)
  // app.put("/users", usersController.updateUser)
  app.delete("/users/:userName", usersController.requireUser, usersController.authenticate(true),
    usersController.deleteUser)
  app.get("/users/:userName", usersController.requireUser, usersController.authenticate(false),
    usersController.getUser)
  // app.patch("/users/:userName", usersController.requireUser, usersController.patchUser)

  app.use(function (err, req, res) {
      // Error handling middleware (must be last use of app)
      const status = err.status || 500
      if (status === 500) console.error(err.stack)
      res
        .status(status)
        .json({
          apiVersion: "1",
          code: status,
          message: err.message || http.STATUS_CODES[status],
        })
    })

  checkDatabase()
    .then(startExpress)
  .catch(error => {
    console.log(error.stack)
    process.exit(1)
  })
})


function startExpress() {
  let host = config.listen.host
  let port = config.listen.port || config.port
  let server = app.listen(port, host, () => {
    console.log(`Listening on ${host || "*"}:${port}...`)
  })
  server.timeout = 5 * 60 * 1000  // 5 minutes (in milliseconds)
}
