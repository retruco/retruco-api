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


import Ajv from "ajv"

import {convertValidJsonToTypedValue, getObjectFromId, toDataJson, wrapAsyncMiddleware} from "../model"
import {schemaByPath} from "../schemas"
import {getIdFromIdOrSymbol} from "../symbols"


const ajvStrict = new Ajv({
  // See: https://github.com/epoberezkin/ajv#options
  allErrors: true,
  format: "full",
  unknownFormats: true,
  verbose: true,
})
for (let [path, schema] of Object.entries(schemaByPath)) {
  ajvStrict.addSchema(schema, path)
}

const ajvWithCoercion = new Ajv({
  // See: https://github.com/epoberezkin/ajv#options
  allErrors: true,
  coerceTypes: "array",
  format: "full",
  unknownFormats: true,
  verbose: true,
})
for (let [path, schema] of Object.entries(schemaByPath)) {
  ajvWithCoercion.addSchema(schema, path)
}


export const createValue = wrapAsyncMiddleware(async function createValue(req, res) {
  // Create a new card, giving its initial attributes, schemas & widgets.
  let authenticatedUser = req.authenticatedUser
  let valueInfos = req.body
  let show = req.query.show || []
  let userId = authenticatedUser.id

  let errors = {}

  // Validate given schema.
  let schema = valueInfos.schema
  if (schema === null || schema === undefined) {
    errors["schema"] = "Missing schema."
  } else {
    if (typeof schema === "string") {
      let schemaId = getIdFromIdOrSymbol(schema)
      schema = (await getObjectFromId(schemaId)).value
      if (schema === undefined) {
        errors["schema"] = `Ùnknown schema: "${schemaId}".`
      }
    }
    try {
      ajvStrict.compile(schema)
    } catch (e) {
      errors["schema"] = e.message
    }
  }

  // Validate given widget (if any).
  let widget = valueInfos.widget
  if (widget === null || widget === undefined) {
    widget = null
  } else {
    if (typeof widget === "string") {
      let widgetId = getIdFromIdOrSymbol(widget)
      widget = (await getObjectFromId(widgetId)).value
      if (widget === undefined) {
        errors["widget"] = `Ùnknown widget: "${widgetId}".`
      }
    }
    // TODO: Validate widget using something like a schema.
  }

  if (Object.keys(errors).length > 0) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400,  // Bad Request
      errors,
      message: "Errors detected in schema and/or widget definitions.",
    })
    return
  }

  // Validate value using given schema.
  let value = valueInfos.value
  let schemaValidator = ajvWithCoercion.compile(schema)
  if (!schemaValidator(value)) {
    res.status(400)
    res.json({
      apiVersion: "1",
      code: 400,  // Bad Request
      errors: {value: schemaValidator.errors},
      message: "Errors detected in given value.",
    })
    return
  }

  let [typedValue, warning] = await convertValidJsonToTypedValue(schema, widget, value, {userId})

  let result = {
    apiVersion: "1",
    data: await toDataJson(typedValue, authenticatedUser, {
      depth: req.query.depth || 0,
      showBallots: show.includes("ballots"),
      showProperties: show.includes("properties"),
      showReferences: show.includes("references"),
      showValues: show.includes("values"),
    }),
  }
  if (warning !== null) result.warnings = {value: warning}
  res.status(201)  // Created
  res.json(result)
})