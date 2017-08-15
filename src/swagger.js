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

import config from "./config"
import { types } from "./model"
import { schemaByPath } from "./schemas"

const schemaSpecificationByPath = {}
for (let [path, schema] of Object.entries(schemaByPath)) {
  schemaSpecificationByPath[path] = {
    get: {
      tags: ["schema"],
      summary: schema.description,
      responses: {
        "200": {
          schema: {
            type: "object",
          },
        },
      },
    },
  }
}

const SPEC = {
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
  paths: Object.assign(schemaSpecificationByPath, {
    "/": {
      get: {
        tags: ["home"],
        summary: "Describe API",
        // description: "",
        // externalDocs: {},
        operationId: "home",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/apiKeyOptionalParam",
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
                  // TODO
                  // $ref: "#/definitions/Home",
                  type: "object",
                },
              },
              required: ["apiVersion", "data"],
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
    "/cards": {
      get: {
        tags: ["card"],
        summary: "List cards",
        // description: "",
        // externalDocs: {},
        operationId: "cards.list",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/languageParam",
          },
          {
            $ref: "#/parameters/limitQueryParam",
          },
          {
            $ref: "#/parameters/offsetQueryParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/tagsQueryParam",
          },
          {
            $ref: "#/parameters/termQueryParam",
          },
          {
            $ref: "#/parameters/typesQueryParam",
          },
          {
            $ref: "#/parameters/userNameQueryParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing cards",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataIdsList",
                },
              },
              required: ["apiVersion", "data"],
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
    "/cards/autocomplete": {
      get: {
        tags: ["autocompletion", "card"],
        summary: "Autocomplete cards",
        // description: "",
        // externalDocs: {},
        operationId: "cards.autocomplete",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/languageParam",
          },
          {
            $ref: "#/parameters/limitQueryParam",
          },
          {
            $ref: "#/parameters/termQueryParam",
          },
          {
            $ref: "#/parameters/typesQueryParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing cards and their autocompletion",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/CardsAutocompletionList",
                },
              },
              required: ["apiVersion", "data"],
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
    "/cards/bundle": {
      post: {
        tags: ["card", "statement"],
        summary: "Update all the user's cards (useful for bots)",
        // description: "",
        // externalDocs: {},
        operationId: "statements.bundleCards",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/cardsBundleBodyParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing optional warnings",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                warnings: {
                  type: "object",
                },
              },
              required: ["apiVersion"],
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
    },
    "/cards/easy": {
      post: {
        tags: ["card", "statement"],
        summary: "Create a new card, giving its initial attributes, schemas & widgets",
        // description: "",
        // externalDocs: {},
        operationId: "statements.createCard",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/cardBodyParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "201": {
            description: "A wrapper containing the created card and eventual warnings",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
                warnings: {
                  type: "object",
                },
              },
              required: ["apiVersion", "data"],
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
    },
    "/cards/tags-popularity": {
      get: {
        tags: ["card", "tag"],
        summary: "List popularity of tags given to cards",
        // description: "",
        // externalDocs: {},
        operationId: "cards.tagsPopularity",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/languageParam",
          },
          {
            $ref: "#/parameters/limitQueryParam",
          },
          {
            $ref: "#/parameters/offsetQueryParam",
          },
          {
            $ref: "#/parameters/tagsQueryParam",
          },
          {
            $ref: "#/parameters/typesQueryParam",
          },
          {
            $ref: "#/parameters/userNameQueryParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing cards",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  type: "object",
                  properties: {
                    popularity: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          count: {
                            minimum: 1,
                            type: "integer",
                          },
                          tagId: {
                            type: "string",
                          },
                        },
                        required: ["count", "tag"],
                      },
                      $ref: "#/definitions/DataIdsList",
                    },
                    values: {
                      type: "object",
                      additionalProperties: {
                        $ref: "#/definitions/Value",
                      },
                    },
                  },
                  required: ["popularity", "values"],
                },
              },
              required: ["apiVersion", "data"],
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
    "/cards/tags-popularity-ogp": {
      get: {
        tags: ["card", "tag"],
        summary: "List popularity of OGP-specific tags given to cards",
        // description: "",
        // externalDocs: {},
        operationId: "cards.tagsPopularity",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/languageParam",
          },
          {
            $ref: "#/parameters/limitQueryParam",
          },
          {
            $ref: "#/parameters/offsetQueryParam",
          },
          {
            $ref: "#/parameters/tagsQueryParam",
          },
          {
            $ref: "#/parameters/typesQueryParam",
          },
          {
            $ref: "#/parameters/userNameQueryParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing cards",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  type: "object",
                  properties: {
                    popularity: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          count: {
                            minimum: 1,
                            type: "integer",
                          },
                          tagId: {
                            type: "string",
                          },
                        },
                        required: ["count", "tag"],
                      },
                      $ref: "#/definitions/DataIdsList",
                    },
                    values: {
                      type: "object",
                      additionalProperties: {
                        $ref: "#/definitions/Value",
                      },
                    },
                  },
                  required: ["popularity", "values"],
                },
              },
              required: ["apiVersion", "data"],
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
    "/collections": {
      get: {
        tags: ["collection"],
        summary: "List collections",
        // description: "",
        // externalDocs: {},
        operationId: "collections.list",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/limitQueryParam",
          },
          {
            $ref: "#/parameters/offsetQueryParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing cards",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataIdsList",
                },
              },
              required: ["apiVersion", "data"],
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
        tags: ["collection"],
        summary: "Create a new collection",
        // description: "",
        // externalDocs: {},
        operationId: "collections.create",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/collectionBodyParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "201": {
            description: "A wrapper containing the created collection",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
                warnings: {
                  type: "object",
                },
              },
              required: ["apiVersion", "data"],
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
    },
    "/collections/{id}": {
      delete: {
        tags: ["collection"],
        summary: "Delete collection",
        // description: "",
        // externalDocs: {},
        operationId: "collections.delete",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/idPathParam",
          },
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing cards",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
              },
              required: ["apiVersion", "data"],
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
      get: {
        tags: ["collection"],
        summary: "Get collection",
        // description: "",
        // externalDocs: {},
        operationId: "collections.get",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/idPathParam",
          },
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing cards",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
              },
              required: ["apiVersion", "data"],
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
        tags: ["collection"],
        summary: "Edit collection",
        // description: "",
        // externalDocs: {},
        operationId: "collections.delete",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/idPathParam",
          },
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/collectionBodyParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing cards",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
              },
              required: ["apiVersion", "data"],
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
              required: ["password", "userName"],
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
              required: ["apiVersion", "data"],
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
    "/objects/{idOrSymbol}": {
      get: {
        tags: ["object"],
        summary: "Get an existing object",
        // description: "",
        // externalDocs: {},
        operationId: "objects.get",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/idOrSymbolPathParam",
          },
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the requested object",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
              },
              required: ["apiVersion", "data"],
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
    "/objects/{idOrSymbol}/debate-properties": {
      get: {
        tags: ["debate", "object", "property"],
        summary: "List all the debate-related properties of an existing object",
        // description: "",
        // externalDocs: {},
        operationId: "objects.listObjectDebateProperties",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/idOrSymbolPathParam",
          },
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the requested properties",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataIdsList",
                },
              },
              required: ["apiVersion", "data"],
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
    "/objects/{idOrSymbol}/next-properties": {
      get: {
        tags: ["object", "property"],
        summary: "List the informations of the next properties for user to create",
        // description: "",
        // externalDocs: {},
        operationId: "objects.nextProperties",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/idOrSymbolPathParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the requested object",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  type: "object",
                  properties: {
                    order: {
                      type: "array",
                      items: [
                        {
                          // key ID or symbol
                          $ref: "#/definitions/IdOrSymbol",
                        },
                        {
                          type: "array",
                          items: [
                            {
                              // schema ID or symbol
                              $ref: "#/definitions/IdOrSymbol",
                            },
                            {
                              type: "array",
                              items: {
                                // widget ID or symbol
                                $ref: "#/definitions/IdOrSymbol",
                              },
                            },
                          ],
                        },
                      ],
                    },
                    values: {
                      type: "object",
                      additionalProperties: {
                        $ref: "#/definitions/Value",
                      },
                    },
                  },
                  required: ["order", "values"],
                },
              },
              required: ["apiVersion", "data"],
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
    "/objects/{idOrSymbol}/properties/{keyIdOrSymbol}": {
      get: {
        tags: ["object", "property"],
        summary: "List all the properties of an existing object having the same key",
        // description: "",
        // externalDocs: {},
        operationId: "objects.listObjectSameKeyProperties",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/idOrSymbolPathParam",
          },
          {
            $ref: "#/parameters/keyIdOrSymbolPathParam",
          },
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the requested object",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataIdsList",
                },
              },
              required: ["apiVersion", "data"],
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
    "/properties": {
      post: {
        tags: ["property"],
        summary: "Create a new property or retrieve the existing one and return it",
        // description: "",
        // externalDocs: {},
        operationId: "properties.getOrCreateProperty",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/propertyBodyParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "201": {
            description: "A wrapper containing the created property and eventual warnings",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
                warnings: {
                  type: "object",
                },
              },
              required: ["apiVersion", "data"],
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
    },
    "/properties/keys/autocomplete": {
      get: {
        tags: ["autocompletion", "key", "property"],
        summary: "Autocomplete keys of properties",
        // description: "",
        // externalDocs: {},
        operationId: "properties.autocompleteKeys",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/classQueryRequiredParam",
          },
          {
            $ref: "#/parameters/languageParam",
          },
          {
            $ref: "#/parameters/limitQueryParam",
          },
          {
            $ref: "#/parameters/termQueryParam",
          },
          {
            $ref: "#/parameters/typesQueryParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing keys of properties and their autocompletion",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/ValuesAutocompletionList",
                },
              },
              required: ["apiVersion", "data"],
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
    "/statements/{statementId}/rating": {
      delete: {
        tags: ["statement", "rating"],
        summary: "Delete an existing statement rating",
        // description: "",
        // externalDocs: {},
        operationId: "statements.deleteBallot",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/statementIdParam",
          },
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the deleted statement rating",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
              },
              required: ["apiVersion", "data"],
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
        tags: ["statement", "rating"],
        summary: "Get a statement rating",
        // description: "",
        // externalDocs: {},
        operationId: "statements.getBallot",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/statementIdParam",
          },
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the requested statement rating",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
              },
              required: ["apiVersion", "data"],
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
        tags: ["statement", "rating"],
        summary: "Create or update statement rating",
        // description: "",
        // externalDocs: {},
        operationId: "statements.upsertBallot",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/statementIdParam",
          },
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/ratingDataParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the updated statement rating",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
              },
              required: ["apiVersion", "data"],
            },
          },
          "201": {
            description: "A wrapper containing the created statement rating",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
              },
              required: ["apiVersion", "data"],
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
    },
    "/swagger.json": {
      get: {
        tags: ["home"],
        summary: "Swagger Specification of API",
        // description: "",
        // externalDocs: {},
        operationId: "swagger",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [],
        responses: {
          "200": {
            description: "A wrapper containing statements",
            schema: {
              type: "object",
            },
          },
        },
        // deprecated: true,
        // schemes: ["http", "https", "ws", "wss"],
        // security: {},
      },
    },
    "/uploads/images": {
      post: {
        tags: ["image", "upload"],
        summary: "Upload images and get its path",
        parameters: [
          {
            description: "The uploaded image",
            in: "formData",
            name: "file",
            required: true,
            type: "file",
          },
        ],
        responses: {
          "201": {
            description: "A wrapper containing the informations about the uploaded images",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  type: "object",
                },
              },
              required: ["apiVersion", "data"],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
      },
    },
    "/uploads/images/json": {
      post: {
        tags: ["image", "upload"],
        summary: "Upload images and get its path",
        parameters: [
          {
            description: "The uploaded image encoded in base64 in JSON body",
            in: "body",
            name: "body",
            required: true,
            schema: {
              type: "object",
              properties: {
                file: {
                  type: "string",
                },
              },
              required: ["file"],
            },
          },
        ],
        responses: {
          "201": {
            description: "A wrapper containing the informations about the uploaded images",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  type: "object",
                },
              },
              required: ["apiVersion", "data"],
            },
          },
          default: {
            description: "Error payload",
            schema: {
              $ref: "#/definitions/Error",
            },
          },
        },
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
              required: ["apiVersion", "data"],
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
              required: ["apiVersion", "data"],
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
    "/users/reset-password": {
      post: {
        tags: ["password", "user"],
        summary: "Reset password of an existing user",
        // description: "",
        // externalDocs: {},
        operationId: "users.create",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            // description: "",
            in: "body",
            name: "user",
            required: true,
            schema: {
              type: "object",
              properties: {
                email: {
                  formet: "email",
                  type: "string",
                },
              },
              required: ["email"],
              $ref: "#/definitions/User",
            },
          },
        ],
        responses: {
          "200": {
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
              required: ["apiVersion", "data"],
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
    "/users/{userName}": {
      delete: {
        tags: ["user"],
        summary: "Delete an existing user",
        // description: "",
        // externalDocs: {},
        operationId: "users.delete",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/userNamePathParam",
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
              required: ["apiVersion", "data"],
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
            $ref: "#/parameters/userNamePathParam",
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
              required: ["apiVersion", "data"],
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
    "/users/{user}/activate": {
      get: {
        tags: ["activation", "user"],
        summary: "Activate a user account",
        // description: "",
        // externalDocs: {},
        operationId: "users.activate",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            description: "The user ID (needeb by Activator)",
            in: "path",
            name: "user",
            required: true,
            type: "string",
            format: "^[0-9]+$",
          },
          {
            description: "The activation JSON Web Token",
            in: "query",
            name: "authorization",
            required: true,
            type: "string",
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
              required: ["apiVersion", "data"],
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
    "/users/{userName}/collections": {
      get: {
        tags: ["collection", "user"],
        summary: "List user collections",
        // description: "",
        // externalDocs: {},
        operationId: "collections.listUser",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/userNamePathParam",
          },
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/limitQueryParam",
          },
          {
            $ref: "#/parameters/offsetQueryParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing collections",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataIdsList",
                },
              },
              required: ["apiVersion", "data"],
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
    "/users/{user}/reset-password": {
      post: {
        tags: ["password", "user"],
        summary: "Change password of an existing user, using a JSON Web Token",
        // description: "",
        // externalDocs: {},
        operationId: "users.create",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            description: "The user ID (needeb by Activator)",
            in: "path",
            name: "user",
            required: true,
            type: "string",
            format: "^[0-9]+$",
          },
          {
            description: "The activation JSON Web Token",
            in: "query",
            name: "authorization",
            required: true,
            type: "string",
          },
          {
            // description: "",
            in: "body",
            name: "user",
            required: true,
            schema: {
              type: "object",
              properties: {
                email: {
                  formet: "password",
                  type: "password",
                },
              },
              required: ["password"],
              $ref: "#/definitions/User",
            },
          },
        ],
        responses: {
          "200": {
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
              required: ["apiVersion", "data"],
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
    "/users/{userName}/send-activation": {
      get: {
        tags: ["activation", "user"],
        summary: "Send (again) an activation email to an already authenticated user.",
        // description: "",
        // externalDocs: {},
        operationId: "users.delete",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/userNamePathParam",
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
              required: ["apiVersion", "data"],
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
    },
    "/values": {
      get: {
        tags: ["value"],
        summary: "List values",
        // description: "",
        // externalDocs: {},
        operationId: "values.list",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/depthParam",
          },
          {
            $ref: "#/parameters/languageParam",
          },
          {
            $ref: "#/parameters/limitQueryParam",
          },
          {
            $ref: "#/parameters/offsetQueryParam",
          },
          {
            $ref: "#/parameters/ratedQueryParam",
          },
          {
            $ref: "#/parameters/showParam",
          },
          {
            $ref: "#/parameters/termQueryParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing values",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataIdsList",
                },
              },
              required: ["apiVersion", "data"],
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
        tags: ["value"],
        summary: "Create a new value or retrieve the existing one and return it, giving its initial schema & widget",
        // description: "",
        // externalDocs: {},
        operationId: "values.createValue",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/valueBodyParam",
          },
          {
            $ref: "#/parameters/apiKeyRequiredParam",
          },
        ],
        responses: {
          "201": {
            description: "A wrapper containing the created value and eventual warnings",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
                warnings: {
                  type: "object",
                },
              },
              required: ["apiVersion", "data"],
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
    },
    "/values/autocomplete": {
      get: {
        tags: ["autocompletion", "value"],
        summary: "Autocomplete values",
        // description: "",
        // externalDocs: {},
        operationId: "properties.autocompleteKeys",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/languageParam",
          },
          {
            $ref: "#/parameters/limitQueryParam",
          },
          {
            $ref: "#/parameters/schemaQueryParam",
          },
          {
            $ref: "#/parameters/termQueryParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing keys of properties and their autocompletion",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/ValuesAutocompletionList",
                },
              },
              required: ["apiVersion", "data"],
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
    "/values/existing": {
      post: {
        tags: ["value"],
        summary: "Retrieve an existing value and return it, giving its initial schema & widget",
        // description: "",
        // externalDocs: {},
        operationId: "values.createValue",
        // consumes: ["application/json"],
        // produces: ["application/json"],
        parameters: [
          {
            $ref: "#/parameters/valueBodyParam",
          },
          {
            $ref: "#/parameters/apiKeyOptionalParam",
          },
        ],
        responses: {
          "200": {
            description: "A wrapper containing the existing value and eventual warnings",
            schema: {
              type: "object",
              properties: {
                apiVersion: {
                  type: "string",
                },
                data: {
                  $ref: "#/definitions/DataId",
                },
                warnings: {
                  type: "object",
                },
              },
              required: ["apiVersion", "data"],
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
    },
    // parameters: {},
  }),
  definitions: {
    AbstractStatement: {
      type: "object",
      discriminator: "type",
      properties: {
        argumentCount: {
          minimum: 0,
          type: "integer",
        },
        ballotId: {
          $ref: "#/definitions/BallotId",
        },
        createdAt: {
          type: "string",
          format: "date-time",
        },
        id: {
          $ref: "#/definitions/Id",
        },
        rating: {
          maximum: 1,
          minimum: -1,
          type: "number",
        },
        ratingCount: {
          minimum: 0,
          type: "integer",
        },
        ratingSum: {
          type: "integer",
        },
        tagIds: {
          type: "array",
          items: {
            $ref: "#/definitions/Id",
          },
        },
        tags: {
          type: "array",
          items: {
            type: "string",
          },
        },
        trashed: {
          type: "boolean",
          default: false,
        },
        type: {
          type: "string",
          enum: types,
        },
      },
      required: ["type"],
    },
    Ballot: {
      type: "object",
      properties: {
        id: {
          $ref: "#/definitions/BallotId",
        },
        rating: {
          maximum: 1,
          minimum: -1,
          type: "integer",
        },
        statementId: {
          $ref: "#/definitions/Id",
        },
        updatedAt: {
          type: "string",
          format: "date-time",
        },
        voterId: {
          $ref: "#/definitions/Id",
        },
      },
      required: ["statementId"],
    },
    BallotId: {
      type: "string",
      pattern: "^[0-9]+/[0-9]+$",
    },
    Card: {
      allOf: [
        {
          $ref: "#/definitions/AbstractStatement",
        },
        {
          type: "object",
          properties: {
            schemas: {
              type: "object",
            },
            values: {
              type: "object",
              additionalProperties: {
                type: "object",
              },
            },
            widgets: {
              type: "object",
            },
          },
          // required: [],
        },
      ],
    },
    CardsAutocompletionList: {
      type: "array",
      items: {
        type: "object",
        properties: {
          autocomplete: {
            type: "string",
          },
          card: {
            $ref: "#/definitions/Card",
          },
          distance: {
            maximum: 1,
            minimum: 0,
            type: "number",
          },
        },
        required: ["autocomplete", "card", "distance"],
      },
    },
    Collection: {
      type: "object",
      properties: {
        authorId: {
          $ref: "#/definitions/Id",
        },
        cardIds: {
          type: "array",
          items: {
            $ref: "#/definitions/Id",
          },
        },
        createddAt: {
          type: "string",
          format: "date-time",
        },
        description: {
          type: "string",
        },
        id: {
          $ref: "#/definitions/Id",
        },
        logo: {
          type: "string",
        },
        name: {
          type: "string",
        },
      },
      required: [
        // "authorId",
        "name",
      ],
    },
    DataId: {
      type: "object",
      properties: {
        ballots: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Ballot",
          },
        },
        cards: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Card",
          },
        },
        collections: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Collection",
          },
        },
        id: {
          $ref: "#/definitions/IdOrBallotId",
        },
        properties: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Property",
          },
        },
        users: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/User",
          },
        },
        values: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Value",
          },
        },
      },
      required: ["id"],
    },
    DataIdsList: {
      type: "object",
      properties: {
        ballots: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Ballot",
          },
        },
        cards: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Card",
          },
        },
        collections: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Collection",
          },
        },
        ids: {
          type: "array",
          items: {
            $ref: "#/definitions/IdOrBallotId",
          },
        },
        properties: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Property",
          },
        },
        users: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/User",
          },
        },
        values: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Value",
          },
        },
      },
      required: ["ids"],
    },
    Error: {
      type: "object",
      properties: {
        apiVersion: {
          type: "string",
        },
        code: {
          type: "integer",
          minimum: 100,
          maximum: 600,
        },
        errors: {
          type: "object",
        },
        message: {
          type: "string",
        },
      },
      required: ["apiVersion", "code", "message"],
    },
    Id: {
      type: "string",
      pattern: "^[0-9]+$",
    },
    IdOrBallotId: {
      type: "string",
      pattern: "^[0-9]+(/[0-9]+)?$",
    },
    IdOrSymbol: {
      type: "string",
    },
    Language: {
      type: "string",
      enum: config.languages,
      pattern: "^[a-z]{2}$",
    },
    Property: {
      allOf: [
        {
          $ref: "#/definitions/AbstractStatement",
        },
        {
          type: "object",
          properties: {
            // language: {
            //   $ref: "#/definitions/Language",
            // },
            name: {
              type: "string",
            },
            schema: {
              $ref: "#/definitions/Schema",
            },
            statementId: {
              $ref: "#/definitions/Id",
            },
            value: {
              // Since Swagger 2 doesn't accept fields having any type of value (primitive, array, object, null),
              // then "value" field is encoded into a JSON string.
              type: "string",
            },
            widget: {
              $ref: "#/definitions/Widget",
            },
          },
          required: ["name", "schema", "value", "widget"],
        },
      ],
    },
    Schema: {
      type: "object",
      // properties: {
      //   type: {
      //     type: "string",
      //     enum: [
      //       "integer",
      //       "string",
      //     ],
      //   },
      // },
      // required: [
      //   "type",
      // ],
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
        email: {
          formet: "email",
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
      required: ["email", "urlName"],
    },
    Value: {
      allOf: [
        {
          $ref: "#/definitions/AbstractStatement",
        },
        {
          type: "object",
          properties: {
            schemaId: {
              $ref: "#/definitions/IdOrSymbol",
            },
            symbol: {
              type: "string",
            },
            // value: anything,
            widgetId: {
              $ref: "#/definitions/IdOrSymbol",
            },
          },
          required: [
            "id",
            "schemaId",
            // "value",
          ],
        },
      ],
    },
    ValuesAutocompletionList: {
      type: "array",
      items: {
        type: "object",
        properties: {
          autocomplete: {
            type: "string",
          },
          distance: {
            maximum: 1,
            minimum: 0,
            type: "number",
          },
          value: {
            $ref: "#/definitions/Value",
          },
        },
        required: ["autocomplete", "distance", "value"],
      },
    },
    Widget: {
      type: "object",
      // properties: {
      //   type: {
      //     type: "string",
      //     enum: [
      //       "textarea",
      //       "textline",
      //     ],
      //   },
      // },
      // required: [
      //   "type",
      // ],
    },
  },
  parameters: {
    apiKeyOptionalParam: {
      description: "Secret key used to identify user",
      // format: "password",  Don't use password format to allow key to be visible in Swagger-UI.
      in: "header",
      name: "retruco-api-key",
      type: "string",
    },
    apiKeyRequiredParam: {
      description: "Secret key used to identify user",
      // format: "password",  Don't use password format to allow key to be visible in Swagger-UI.
      in: "header",
      name: "retruco-api-key",
      required: true,
      type: "string",
    },
    cardBodyParam: {
      // description: "",
      in: "body",
      name: "cardInfos",
      required: true,
      schema: {
        type: "object",
        properties: {
          language: {
            description: "Language used by default by the card (for example, for the keys of its attributes)",
            $ref: "#/definitions/Language",
          },
          schemas: {
            type: "object",
          },
          values: {
            type: "object",
          },
          widgets: {
            type: "object",
          },
        },
        required: ["language", "schemas", "values", "widgets"],
      },
    },
    cardsBundleBodyParam: {
      // description: "",
      in: "body",
      name: "bundle",
      required: true,
      schema: {
        type: "object",
        properties: {
          cards: {
            type: "array",
            items: {
              type: "object",
            },
          },
          key: {
            type: "string",
          },
          language: {
            description: "Language used by default by the cards (for example, for the keys of their attributes)",
            $ref: "#/definitions/Language",
          },
          schemas: {
            type: "object",
          },
          widgets: {
            type: "object",
          },
        },
        required: ["cards", "key", "language"],
      },
    },
    classQueryRequiredParam: {
      // description: "",
      in: "query",
      name: "class",
      required: true,
      type: "string",
      enum: types,
    },
    collectionBodyParam: {
      // description: "",
      in: "body",
      name: "collectionInfos",
      required: true,
      schema: {
        $ref: "#/definitions/Collection",
      },
    },
    createdAtParam: {
      // description: "",
      in: "path",
      name: "createdAt",
      required: true,
      type: "string",
      format: "date-time",
    },
    depthParam: {
      // description: "",
      in: "query",
      minimum: 0,
      name: "depth",
      type: "integer",
    },
    groundIdParam: {
      // description: "",
      in: "path",
      name: "groundId",
      required: true,
      // A reference to a non-object definition doesn't work for a parameter that is not in request body.
      // schema: {
      //   $ref: "#/definitions/Id",
      // },
      type: "string",
      pattern: "^[0-9]+$",
    },
    idOrSymbolPathParam: {
      description: "Either an object ID or an object symbol",
      in: "path",
      name: "idOrSymbol",
      required: true,
      type: "string",
    },
    idPathParam: {
      // description: "",
      in: "path",
      name: "id",
      required: true,
      // A reference to a non-object definition doesn't work for a parameter that is not in request body.
      // schema: {
      //   $ref: "#/definitions/Id",
      // },
      type: "string",
      pattern: "^[0-9]+$",
    },
    keyIdOrSymbolPathParam: {
      description: "Either an object ID or an object symbol",
      in: "path",
      name: "keyIdOrSymbol",
      required: true,
      type: "string",
    },
    languageParam: {
      // description: "",
      in: "query",
      name: "language",
      type: "string",
      enum: config.languages,
      pattern: "^[a-z]{2}$",
    },
    limitQueryParam: {
      // description: "",
      in: "query",
      maximum: 100,
      minimum: 1,
      name: "limit",
      type: "integer",
    },
    offsetQueryParam: {
      // description: "",
      in: "query",
      minimum: 0,
      name: "offset",
      type: "integer",
    },
    propertyBodyParam: {
      // description: "",
      in: "body",
      name: "valueInfos",
      required: true,
      schema: {
        type: "object",
        properties: {
          keyId: {
            $ref: "#/definitions/IdOrSymbol",
          },
          objectId: {
            $ref: "#/definitions/IdOrSymbol",
          },
          rating: {
            type: "integer",
            maximum: 1,
            minimum: -1,
          },
          valueId: {
            $ref: "#/definitions/IdOrSymbol",
          },
        },
        required: ["keyId", "objectId", "valueId"],
      },
    },
    ratedQueryParam: {
      // description: "",
      in: "query",
      name: "rated",
      type: "boolean",
    },
    ratingDataParam: {
      // description: "",
      in: "body",
      name: "ratingData",
      required: true,
      schema: {
        type: "object",
        properties: {
          rating: {
            type: "integer",
            maximum: 1,
            minimum: -1,
          },
        },
        required: ["rating"],
      },
    },
    schemaQueryParam: {
      // description: "",
      in: "query",
      name: "schema",
      type: "array",
      items: {
        type: "string",
      },
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
      pattern: "^[0-9]+$",
    },
    tagNamePathParam: {
      // description: "",
      in: "path",
      name: "tagName",
      required: true,
      type: "string",
    },
    tagsQueryParam: {
      // description: "",
      in: "query",
      name: "tag",
      type: "array",
      items: {
        type: "string",
      },
      collectionFormat: "multi",
    },
    termQueryParam: {
      // description: "",
      in: "query",
      name: "term",
      type: "string",
    },
    typesQueryParam: {
      // description: "",
      in: "query",
      name: "type",
      type: "array",
      items: {
        type: "string",
      },
      collectionFormat: "multi",
    },
    userNamePathParam: {
      // description: "",
      in: "path",
      name: "userName",
      required: true,
      type: "string",
    },
    userNameQueryParam: {
      // description: "",
      in: "query",
      name: "user",
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
    valueBodyParam: {
      // description: "",
      in: "body",
      name: "valueInfos",
      required: true,
      schema: {
        type: "object",
        // properties: {
        //   schema: {
        //     type: "object",
        //   },
        //   value: can be anything,
        //   widget: {
        //     type: "object",
        //   },
        // },
        // required: [
        //   "schema",
        //   "value",
        //   "widget",
        // ],
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
  //     name: "retruco-api-key",
  //     type: "apiKey",
  //   },
  //   basic: {
  //     description: "HTTP Basic authentication with user (or bot) name and password",
  //     type: "basic",
  //   },
  // },
  // tags: [],
}
export default SPEC
