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


import config from "../config"


export const SPEC = {
  swagger: "2.0",
  info: {
    title: config.title,
    description: config.description,
    // termsOfService: "http://api.retruco.org/terms",
    contact: config.contact,
    license: config.license,
    version: "1",
  },
  host: [80, 443].includes(config.port) ? config.host.toString() : `${config.host}:${config.port}`,
  // basePath: "",
  // schemes: ["http", "https", "ws", "wss"],
  consumes: ["application/json"],
  produces: ["application/json"],
  paths: {
    "/statements": {
      get: {
        tags: ["statement"],
        summary: "List statements",
        // description: "",
        // externalDocs: {},
        operationId: "statements.list",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [],
        responses: {
          "200": {
            description: "A wrapper containing statements",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  type: "array",
                  items: {
                    $ref: "#/definitions/Statement",
                  },
                },
              },
              required: [
                "apiVersion",
                "data",
              ],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
        // deprecated: true,
        // schemes: ["http", "https", "ws", "wss"],
        // security: {},
      },
      post: {
        tags: ["statement"],
        summary: "Create a new statement",
        // description: "",
        // externalDocs: {},
        operationId: "statements.create",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/statementParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "201": {
            description: "A wrapper containing the created statement",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/Statement",
                },
              },
              required: [
                "apiVersion",
                "data",
              ],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
        // deprecated: true,
        // schemes: ["http", "https", "ws", "wss"],
        // security: [{apiKey: []}, {basic: []}],
      },
      // put: {
      //   tags: ["statement"],
      //   summary: "Update an existing statement",
      //   // description: "",
      //   // externalDocs: {},
      //   operationId: "statements.update",
      //   // consumes: ["application/json"],
      //   // produces: ["application/json"],
      //   parameters: [
      //     {
      //       $ref: "#/parameters/statementParam",
      //     },
      //     {
      //       $ref: "#/parameters/apiKeyRequiredParam",
      //     },
      //   ],
      //   responses: {
      //     "200": {
      //       description: "A wrapper containing the updated statement",
      //       schema: {
      //         type: "object",
      //         properties: {
      //           apiVersion: {
      //             type: "string",
      //           },
      //           data: {
      //             $ref: "#/definitions/Statement",
      //           },
      //         },
      //         required: [
      //           "apiVersion",
      //           "data",
      //         ],
      //       },
      //     },
      //     default: {
      //       description: "Error payload",
      //       schema: {
      //         $ref: "#/definitions/Error",
      //       },
      //     },
      //   },
      //   // deprecated: true,
      //   // schemes: ["http", "https", "ws", "wss"],
      //   // security: [{apiKey: []}, {basic: []}],
      // },
    },
    "/statements/{statementLanguage}": {
      get: {
        tags: ["statement"],
        summary: "List statements in given language",
        // description: "",
        // externalDocs: {},
        operationId: "statements.listLanguage",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/statementLanguageParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing statements",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  type: "array",
                  items: {
                    $ref: "#/definitions/Statement",
                  },
                },
              },
              required: [
                "apiVersion",
                "data",
              ],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
        // deprecated: true,
        // schemes: ["http", "https", "ws", "wss"],
        // security: {},
      },
    },
    "/statements/{statementId}": {
      delete: {
        tags: ["statement"],
        summary: "Delete an existing statement",
        // description: "",
        // externalDocs: {},
        operationId: "statements.del",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/statementIdParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the deleted statement",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/Statement",
                },
              },
              required: [
                "apiVersion",
                "data",
              ],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
        // deprecated: true,
        // schemes: ["http", "https", "ws", "wss"],
        // security: [{apiKey: []}, {basic: []}],
      },
      get: {
        tags: ["statement"],
        summary: "Get a statement",
        // description: "",
        // externalDocs: {},
        operationId: "statements.get",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/statementIdParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the requested statement",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/Statement",
                },
              },
              required: [
                "apiVersion",
                "data",
              ],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
        // deprecated: true,
        // schemes: ["http", "https", "ws", "wss"],
        // security: {},
      },
    },
    "/login": {
      post: {
        tags: ["user"],
        summary: "Login (to retrieve API key)",
        // description: "",
        // externalDocs: {},
        operationId: "users.login",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            name: "user",
            in: "body",
            // description: "",
            required: true,
            schema: {
              type: "object",
              properties: {
                password: {
                  type: "string",
                },
                userName: {
                  type: "string",
                },
              },
              required: [
                "password",
                "userName",
              ],
            },
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the logged-in user (with its API key)",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/User",
                },
              },
              required: [
                "apiVersion",
                "data",
              ],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
        // deprecated: true,
        // schemes: ["http", "https", "ws", "wss"],
        // security: {},
      },
    },
    "/users": {
      get: {
        tags: ["user"],
        summary: "List IDs of users",
        // description: "",
        // externalDocs: {},
        operationId: "users.list",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [],
        responses: {
          "200": {
            description: "A wrapper containing references to users",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  type: "array",
                  items: {
                    $ref: "#/definitions/UrlName",
                  },
                },
              },
              required: [
                "apiVersion",
                "data",
              ],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
        // deprecated: true,
        // schemes: ["http", "https", "ws", "wss"],
        // security: {},
      },
      post: {
        tags: ["user"],
        summary: "Create a new user",
        // description: "",
        // externalDocs: {},
        operationId: "users.create",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/userParam",
          },
        ],
        responses: {
          "201": {
            description: "A wrapper containing the created user",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/User",
                },
              },
              required: [
                "apiVersion",
                "data",
              ],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
        // deprecated: true,
        // schemes: ["http", "https", "ws", "wss"],
        // security: {},
      },
      // put: {
      //   tags: ["user"],
      //   summary: "Update an existing user",
      //   // description: "",
      //   // externalDocs: {},
      //   operationId: "users.update",
      //   // consumes: ["application/json"],
      //   // produces: ["application/json"],
      //   parameters: [
      //     {
      //       $ref: "#/parameters/userParam",
      //     },
      //     {
      //       $ref: "#/parameters/apiKeyRequiredParam",
      //     },
      //   ],
      //   responses: {
      //     "200": {
      //       description: "A wrapper containing the updated user",
      //       schema: {
      //         type: "object",
      //         properties: {
      //           apiVersion: {
      //             type: "string",
      //           },
      //           data: {
      //             $ref: "#/definitions/User",
      //           },
      //         },
      //         required: [
      //           "apiVersion",
      //           "data",
      //         ],
      //       },
      //     },
      //     default: {
      //       description: "Error payload",
      //       schema: {
      //         $ref: "#/definitions/Error",
      //       },
      //     },
      //   },
      //   deprecated: true,
      //   schemes: ["http", "https", "ws", "wss"],
      //   security: [{apiKey: []}, {basic: []}],
      // },
    },
    "/users/{userName}": {
      delete: {
        tags: ["user"],
        summary: "Delete an existing user",
        // description: "",
        // externalDocs: {},
        operationId: "users.del",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/userNameParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the deleted user",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/User",
                },
              },
              required: [
                "apiVersion",
                "data",
              ],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
        // deprecated: true,
        // schemes: ["http", "https", "ws", "wss"],
        // security: [{apiKey: []}, {basic: []}],
      },
      get: {
        tags: ["user"],
        summary: "Get a user",
        // description: "",
        // externalDocs: {},
        operationId: "users.get",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/userNameParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the requested user",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/User",
                },
              },
              required: [
                "apiVersion",
                "data",
              ],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
        // deprecated: true,
        // schemes: ["http", "https", "ws", "wss"],
        // security: {},
      },
    },
    // parameters: {},
  },
  definitions: {
    Id: {
      type: "string",
      pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{8}$",
    },
    Language: {
      type: "string",
      pattern: "^[a-z]{2}$",
    },
    Statement: {
      type: "object",
      properties: {
        createdAt: {
          type: "string",
          format: "date-time",
        },
        language: {
          $ref: "#/definitions/language",
        },
        name: {
          type: "string",
        },
      },
      required: [
        "language",
        "name",
      ],
    },
    UrlName: {
      type: "string",
    },
    User: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
        },
        id: {
          $ref: "#/definitions/Id",
        },
        name: {
          type: "string",
        },
        password: {
          type: "string",
        },
        urlName: {
          type: "string",
        },
      },
      required: [
        "urlName",
      ],
    },
  },
  parameters: {
    apiKeyOptionalParam: {
      description: "Secret key used to identify user",
      // format: "password",  Don't use password format to allow key to be visible in Swagger-UI.
      in: "header",
      name: "Retruco-API-api-key",
      type: "string",
    },
    apiKeyRequiredParam: {
      description: "Secret key used to identify user",
      // format: "password",  Don't use password format to allow key to be visible in Swagger-UI.
      in: "header",
      name: "Retruco-API-api-key",
      required: true,
      type: "string",
    },
    createdAtParam: {
      // description: "",
      in: "path",
      name: "createdAt",
      required: true,
      type: "string",
      format: "date-time",
    },
    idParam: {
      // description: "",
      in: "path",
      name: "id",
      required: true,
      // A reference to a non-object definition doesn't work for a parameter that is not in request body.
      // schema: {
      //   $ref: "#/definitions/Id",
      // },
      type: "string",
      pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{8}$",
    },
    showParam: {
      // description: "",
      in: "query",
      name: "show",
      type: "array",
      items: {
        type: "string",
      },
      collectionFormat: "multi",
    },
    statementIdParam: {
      // description: "",
      in: "path",
      name: "statementId",
      required: true,
      // A reference to a non-object definition doesn't work for a parameter that is not in request body.
      // schema: {
      //   $ref: "#/definitions/Id",
      // },
      type: "string",
      pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{8}$",
    },
    statementLanguageParam: {
      // description: "",
      in: "path",
      name: "statementLanguage",
      required: true,
      type: "string",
      pattern: "^[a-z]{2}$",
    },
    statementParam: {
      // description: "",
      in: "body",
      name: "statement",
      required: true,
      schema: {
        $ref: "#/definitions/Statement",
      },
    },
    userNameParam: {
      // description: "",
      in: "path",
      name: "userName",
      required: true,
      type: "string",
    },
    userParam: {
      // description: "",
      in: "body",
      name: "user",
      required: true,
      schema: {
        $ref: "#/definitions/User",
      },
    },
  },
  // externalDocs: {},
  // responses: {},
  // security: {},
  // securityDefinitions: {
  //   apiKey: {
  //     description: "Secret key used to identify user or bot",
  //     in: "header",
  //     name: "Retruco-API-api-key",
  //     type: "apiKey",
  //   },
  //   basic: {
  //     description: "HTTP Basic authentication with user (or bot) name and password",
  //     type: "basic",
  //   },
  // },
  // tags: [],
}


export {get}
async function get(ctx){
  ctx.body = JSON.stringify(SPEC)
}
