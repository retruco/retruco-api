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


export const bijectiveUriReference = {
  type: "object",
  properties: {
    "reverseName": {
      type: "string",
    },
    "targetId": {
      type: "string",
      pattern: "^[0-9]+$",
    },
  },
  required: [
    "reverseName",
    "targetId",
  ],
}

// The same schema, except that targetId is not required to be a number.
// Used in bundles because the id of the cards is not known.
export const bijectiveUriReferenceForBundle = {
  type: "object",
  properties: {
    "reverseName": {
      type: "string",
    },
    "targetId": {
      type: "string",
    },
  },
  required: [
    "reverseName",
    "targetId",
  ],
}
