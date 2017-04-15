// Retruco-API -- HTTP API to bring out shared positions from argumented arguments
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

export const schemaByPath = {
  "/schemas/bijective-card-reference": {
    description: "JSON Schema for a bijective card reference (using IDs or symbols)",
    type: "object",
    properties: {
      reverseKeyId: {
        type: "string",
      },
      targetId: {
        type: "string",
      },
    },
    required: ["reverseKeyId", "targetId"],
  },
  "/schemas/card-id": {
    description: "JSON Schema for a card reference (ID or symbol)",
    type: "string",
  },
  "/schemas/localized-string": {
    description: "JSON Schema for a string localized in several languages",
    type: "object",
    patternProperties: {
      "^[a-z]{2}$": {
        type: "string",
      },
    },
  },
  "/schemas/value-id": {
    description: "JSON Schema for a value reference (ID or symbol)",
    type: "string",
  },
}

export const bundleSchemaByPath = Object.assign({}, schemaByPath, {
  "/schemas/localized-string": {
    description: "JSON Schema for a string localized in several languages (version for bundles)",
    anyOf: [
      {
        type: "string",
      },
      {
        type: "object",
        patternProperties: {
          "^[a-z]{2}$": {
            type: "string",
          },
        },
      },
    ],
  },
})
