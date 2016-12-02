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


import assert from "assert"

import config from "./config"
import {db} from "./database"
import {getIdFromIdOrSymbol, getIdFromSymbolOrFail, getSymbolOrId, idBySymbol} from "./symbols"


export const languageConfigurationNameByCode = {
  en: "english",
  fr: "french",
  es: "spanish",
}


export const types = [
  "Card",
  "Concept",
  "Property",
  "User",
  "Value",
]


export async function addAction(objectId, type) {
  await db.none(
    `
      INSERT INTO actions(created_at, object_id, type)
      VALUES (current_timestamp, $<objectId>, $<type>)
      ON CONFLICT (object_id, type)
      DO NOTHING
    `,
    {
      objectId,
      type,
    },
  )
  return null
}


export function addReferences(referencedIds, schema, value) {
  if (schema.$ref === "/schemas/bijective-card-reference") {
    referencedIds.add(value.targetId)
  } else if (schema.type === "array") {
    if (Array.isArray(schema.items)) {
      for (let [index, itemSchema] of schema.items.entries()) {
        addReferences(referencedIds, itemSchema, value[index])
      }
    } else {
      for (let itemValue of value) {
        addReferences(referencedIds, schema.items, itemValue)
      }
    }
  } else if (["/schemas/card-reference", "/schemas/type-reference"].includes(schema.$ref)) {
    referencedIds.add(value)
  }
}


export async function convertJsonToFieldValue(schema, widget, value) {
  // Convert symbols to IDs, etc.
  let warning = null
  if (schema.$ref === "/schemas/type-reference") {
    let subTypeId = getIdFromIdOrSymbol(value)
    if (!subTypeId || !(await db.one("SELECT EXISTS (SELECT 1 FROM types WHERE id = $1)", subTypeId)).exists) {
      warning = `Unknown referenced type: "${value}".`
      schema = {type: "string"}
      // TODO: Change widget.
    } else {
      value = subTypeId
    }
  } else if (schema.type === "array" && schema.items.$ref === "/schemas/type-reference") {
    let items = []
    for (let [index, item] of value.entries()) {
      let subTypeId = getIdFromIdOrSymbol(item)
      if (!subTypeId || !(await db.one("SELECT EXISTS (SELECT 1 FROM types WHERE id = $1)", subTypeId)).exists) {
        if (warning === null) warning = {}
        warning[String(index)] = `Unknown referenced type: "${item}".`

        schema = Object.assign({}, schema)
        if (Array.isArray(schema.items)) schema.items = [...schema.items]
        else schema.items = value.map(() => Object.assign({}, schema.items))
        schema.items[index] = {type: "string"}
        // TODO: Change widget.
      } else {
        item = subTypeId
      }
      items.push(item)
    }
    value = items
  }
  return [schema, widget, value, warning]
}


export async function describe(object) {
  if (object === null) return "missing object"
  const type = object.type
  if (type === "Card") {
    return `card ${object.id}`
  } else if (type === "Concept") {
    const valueDescription = await describe(await getObjectFromId(object.valueId))
    return `concept based on ${valueDescription}`
  } else if (type === "Property") {
    const keyDescription = await describe(await getObjectFromId(object.keyId))
    const objectDescription = await describe(await getObjectFromId(object.objectId))
    const valueDescription = await describe(await getObjectFromId(object.valueId))
    return `property of ${objectDescription}: ${keyDescription} = ${valueDescription}`
  } else if (type === "User") {
    return `user ${object.name} <${object.email}>`
  } else if (type === "Value") {
    return `value ${JSON.stringify(object.value)}`
  } else {
    return `object of unknown type ${type}`
  }
}


export function entryToAction(entry) {
  return entry === null ? null : {
    createdAt: entry.created_at,
    id: entry.id,  // Use string for id.
    objectId: entry.object_id,
    type: entry.type,
  }
}


export function entryToBallot(entry) {
  return entry === null ? null : {
    id: `${entry.statement_id}/${entry.voter_id}`,
    rating: parseInt(entry.rating),
    statementId: entry.statement_id,
    updatedAt: entry.updated_at,
    voterId: entry.voter_id,
  }
}


export function entryToCard(entry) {
  return entry === null ? null : Object.assign({}, entryToStatement(entry))
}


export function entryToConcept(entry) {
  return entry === null ? null : Object.assign({}, entryToStatement(entry), {
    valueId: entry.value_id,
  })
}


export function entryToProperty(entry) {
  return entry === null ? null : Object.assign({}, entryToStatement(entry), {
    keyId: entry.key_id,
    objectId: entry.object_id,
    valueId: entry.value_id,
  })
}


export function entryToObject(entry) {
  return entry === null ? null : {
    createdAt: entry.created_at,
    id: entry.id,
    properties: entry.properties,
    subTypeIds: entry.sub_types,
    symbol: entry.symbol,  // Given only when JOIN with table symbols
    tags: entry.tags,
    type: entry.type,
  }
}


export function entryToStatement(entry) {
  return entry === null ? null : Object.assign({}, entryToObject(entry), {
    rating: entry.rating,
    ratingCount: entry.rating_count,
    ratingSum: entry.rating_sum,
  })
}


export function entryToUser(entry) {
  return entry === null ? null : Object.assign({}, entryToObject(entry), {
    activated: entry.activated,
    apiKey: entry.api_key,
    email: entry.email,
    isAdmin: entry.is_admin,
    name: entry.name,
    passwordDigest: entry.password_digest,
    salt: entry.salt,
    urlName: entry.url_name,
  })
}


export function entryToValue(entry) {
  return entry === null ? null : Object.assign({}, entryToObject(entry), {
    schemaId: entry.schema_id,
    value: entry.value,
    widgetId: entry.widget_id,
  })
}


export async function generateObjectTextSearch(object) {
  if (object === null) return
  let autocomplete = null
  let languages = []
  let searchableTextsByLanguage = {}
  let table = null
  if (object.type === "Card") {
    table = "cards"
    languages = config.languages
    let valueIdByKeyId = object.properties
    if (valueIdByKeyId) {
      for (let keySymbol of ["name", "title"]) {
        let valueId = valueIdByKeyId[getIdFromSymbolOrFail(keySymbol)]
        if (valueId !== undefined) {
          let value = await getObjectFromId(valueId)
          assert.ok(value, `Missing value at ID ${valueId}`)
          autocomplete = String(value.value)
          break
        }
      }
      for (let keySymbol of ["twitter-name"]) {
        let valueId = valueIdByKeyId[getIdFromSymbolOrFail(keySymbol)]
        if (valueId !== undefined) {
          let value = await getObjectFromId(valueId)
          assert.ok(value, `Missing value at ID ${valueId}`)
          autocomplete = autocomplete ? `${autocomplete} (${value.value})` : `(${value.value})`
          break
        }
      }
      autocomplete = autocomplete ? `${autocomplete} #${object.id}` : `#${object.id}`
      for (let keySymbol of ["name", "title", "twitter-name"]) {
        let valueId = valueIdByKeyId[getIdFromSymbolOrFail(keySymbol)]
        if (valueId === undefined) continue
        let value = await getObjectFromId(valueId)
        assert.ok(value, `Missing value at ID ${valueId}`)
        if (value.schemaId === getIdFromSymbolOrFail("schema:localized-string")) {
          for (let [language, text] of Object.entries(value.value)) {
            if (!text) continue
            let searchableTexts = searchableTextsByLanguage[language]
            if (searchableTexts === undefined) searchableTextsByLanguage[language] = searchableTexts = []
            searchableTexts.push(text)
          }
        }
      }
    }
  } else if (object.type === "Concept") {
    table = "concepts"
    autocomplete = String(object.value)
    // languageConfigurationNames = [languageConfigurationNameByCode[object.language]]
    languages = config.languages
    // TODO: searchableTextsByLanguage
  } else if (object.type === "Value") {
    table = "values"
    autocomplete = String(object.value)
    // languageConfigurationNames = [languageConfigurationNameByCode[object.language]]
    languages = config.languages
    // TODO: searchableTextsByLanguage
  } else if (object.type === "User") {
    table = "users"
    autocomplete = `${object.name} <${object.email}>`
    // languageConfigurationNames = [languageConfigurationNameByCode[object.language]]
    languages = config.languages
    for (let language of languages) {
      for (let text of [
        object.name,
        object.email,
      ]) {
        if (text) {
          let searchableTexts = searchableTextsByLanguage[language]
          if (searchableTexts === undefined) searchableTextsByLanguage[language] = searchableTexts = []
          searchableTexts.push(text)
        }
      }
    }
  }

  if (table) {
    if (!autocomplete) {
      await db.none(`DELETE FROM ${table}_autocomplete WHERE id = $1`, object.id)
    } else {
      await db.none(
        `
          INSERT INTO ${table}_autocomplete(id, autocomplete)
          VALUES ($1, $2)
          ON CONFLICT (id)
          DO UPDATE SET autocomplete = $2
        `,
        [object.id, autocomplete],
      )
    }

    if (Object.keys(searchableTextsByLanguage).length === 0) {
      await db.none(`DELETE FROM ${table}_text_search WHERE id = $1`, object.id)
    } else {
      for (let [language, searchableTexts] of Object.entries(searchableTextsByLanguage)) {
        let languageConfigurationName = languageConfigurationNameByCode[language]
        assert.ok(languageConfigurationName, language)
        let searchableText = searchableTexts.join(" ")
        await db.none(
          `INSERT INTO ${table}_text_search(id, configuration_name, text_search)
            VALUES ($1, $2, to_tsvector($2, $3))
            ON CONFLICT (id, configuration_name)
            DO UPDATE SET text_search = to_tsvector($2, $3)
          `,
          [object.id, languageConfigurationName, searchableText],
        )
      }
      let languageConfigurationNames = Object.keys(searchableTextsByLanguage).map(
        language => languageConfigurationNameByCode[language])
      await db.none(
        `DELETE FROM ${table}_text_search WHERE id = $1 AND configuration_name NOT IN ($2:csv)`,
        [object.id, languageConfigurationNames],
      )
    }
  }
}


export async function getObjectFromId(id) {
  let entry = await db.oneOrNone("SELECT * FROM objects WHERE id = $1", id)
  if (entry === null) return null
  if (entry.type === "Card") {
    let cardEntry = await db.oneOrNone(
      `
        SELECT statements.*, cards.*, symbol
        FROM statements
        INNER JOIN cards ON statements.id = cards.id
        LEFT JOIN symbols ON cards.id = symbols.id
        WHERE statements.id = $<id>
      `,
      entry,
    )
    if (cardEntry === null) {
      console.log(`Missing cards row for object of type Card at ID ${entry.id}`)
      return null
    }
    return entryToCard(Object.assign(entry, cardEntry))
  } else if (entry.type === "Concept") {
    let conceptEntry = await db.oneOrNone(
      `
        SELECT statements.*, concepts.*, symbol
        FROM statements
        INNER JOIN concepts ON statements.id = concepts.id
        LEFT JOIN symbols ON concepts.id = symbols.id
        WHERE statements.id = $<id>
      `,
      entry,
    )
    if (conceptEntry === null) {
      console.log(`Missing concepts row for object of type Concept at ID ${entry.id}`)
      return null
    }
    return entryToConcept(Object.assign(entry, conceptEntry))
  } else if (entry.type === "Property") {
    let propertyEntry = await db.oneOrNone(
      `
        SELECT statements.*, properties.*, symbol
        FROM statements
        INNER JOIN properties ON statements.id = properties.id
        LEFT JOIN symbols ON properties.id = symbols.id
        WHERE statements.id = $<id>
      `,
      entry,
    )
    if (propertyEntry === null) {
      console.log(`Missing properties row for object of type Property at ID ${entry.id}`)
      return null
    }
    return entryToProperty(Object.assign(entry, propertyEntry))
  } else if (entry.type === "User") {
    let userEntry = await db.oneOrNone(
      `
        SELECT users.*, symbol
        FROM users
        LEFT JOIN symbols ON users.id = symbols.id
        WHERE users.id = $<id>
      `,
      entry,
    )
    if (userEntry === null) {
      console.log(`Missing users row for object of type User at ID ${entry.id}`)
      return null
    }
    return entryToUser(Object.assign(entry, userEntry))
  } else if (entry.type === "Value") {
    let valueEntry = await db.oneOrNone(
      `
        SELECT values.*, symbol
        FROM values
        LEFT JOIN symbols ON values.id = symbols.id
        WHERE values.id = $<id>
      `,
      entry,
    )
    if (valueEntry === null) {
      console.log(`Missing values row for object of type Value at ID ${entry.id}`)
      return null
    }
    return entryToValue(Object.assign(entry, valueEntry))
  } else {
    throw `Unknown object type "${entry.type}" at ID ${id}`
  }
}


export async function getOrNewLocalizedString(typedLanguage, string, {inactiveStatementIds = null, properties = null,
  userId = null} = {}) {
  let localizedString = {
    [typedLanguage.symbol.split(".")[1]]: string,
  }
  return await getOrNewValue(
    getIdFromSymbolOrFail("schema:localized-string"),
    getIdFromSymbolOrFail("widget:input-text"),
    localizedString, {
      inactiveStatementIds,
      properties,
      userId,
    },
  )
}


export async function getOrNewProperty(objectId, keyId, valueId, {inactiveStatementIds = null, properties = null,
  userId = null} = {}) {
  assert.strictEqual(typeof objectId, "string")
  assert.strictEqual(typeof keyId, "string")
  assert.strictEqual(typeof valueId, "string")
  if (properties) assert(userId, "Properties can only be set when userId is not null.")
  let property = entryToProperty(await db.oneOrNone(
    `
      SELECT objects.*, statements.*, properties.*, symbol FROM objects
      INNER JOIN statements ON objects.id = statements.id
      INNER JOIN properties ON statements.id = properties.id
      LEFT JOIN symbols ON objects.id = symbols.id
      WHERE object_id = $<objectId>
      AND key_id = $<keyId>
      AND value_id = $<valueId>
    `,
    {
      keyId,
      objectId,
      valueId,
    },
  ))
  if (property === null) {
    let result = await db.one(
      `
        INSERT INTO objects(created_at, properties, type)
        VALUES (current_timestamp, $<properties:json>, 'Property')
        RETURNING created_at, id, properties, sub_types, tags, type
      `,
      {
        properties,  // Note: Properties are typically set for optimistic optimization.
      },
    )
    property = {
      createdAt: result.created_at,
      id: result.id,
      keyId,
      objectId,
      properties,
      subTypeIds: result.sub_types,
      tags: result.tags,
      type: result.type,
      valueId,
    }
    result = await db.one(
      `
        INSERT INTO statements(id)
        VALUES ($<id>)
        RETURNING rating, rating_count, rating_sum
      `,
      property,
    )
    Object.assign(property, {
      rating: result.rating,
      ratingCount: result.rating_count,
      ratingSum: result.rating_sum,
    })
    await db.none(
      `
        INSERT INTO properties(id, key_id, object_id, value_id)
        VALUES ($<id>, $<keyId>, $<objectId>, $<valueId>)
      `,
      property,
    )
  }
  await generateObjectTextSearch(property)
  if (userId) {
    await rateStatement(property.id, userId, 1)
    if (inactiveStatementIds) inactiveStatementIds.delete(property.id)
  }
  if (properties) {
    property.propertyByKeyId = {}
    for (let [keyId, valueId] of Object.entries(properties)) {
      assert.strictEqual(typeof keyId, "string")
      assert.strictEqual(typeof valueId, "string")
      property.propertyByKeyId[keyId] = await getOrNewProperty(property.id, keyId, valueId, {inactiveStatementIds,
        userId})
    }
  }
  return property
}


export async function getOrNewValue(schemaId, widgetId, value, {inactiveStatementIds, properties = null,
  userId = null} = {}) {
  assert(typeof schemaId === "string")
  if (properties) assert(userId, "Properties can only be set when userId is not null.")

  // Note: getOrNewValue may be called before the ID of the symbol "schema:localized-string" is known. So it is not
  // possible to use function getIdFromSymbolOrFail("schema:localized-string").
  let localizedStringSchemaId = idBySymbol["schema:localized-string"]
  if (localizedStringSchemaId && schemaId === localizedStringSchemaId) {
    // Getting and rating a localized string, requires to get and rate each of its strings.
    if (!properties) properties = {}
    for (let [language, string] of Object.entries(value)) {
      let typedString = await getOrNewValue(getIdFromSymbolOrFail("schema:string"), null, string,
        {inactiveStatementIds, userId})
      properties[getIdFromSymbolOrFail(`localization.${language}`)] = typedString.id
    }
  }

  let typedValue = await getValue(schemaId, widgetId, value)
  if (typedValue === null) {
    let result = await db.one(
      `
        INSERT INTO objects(created_at, properties, type)
        VALUES (current_timestamp, $<properties:json>, 'Value')
        RETURNING created_at, id, properties, sub_types, tags, type
      `,
      {
        properties,  // Note: Properties are typically set for optimistic optimization.
      },
    )
    typedValue = {
      createdAt: result.created_at,
      id: result.id,
      properties,
      schemaId,
      subTypeIds: result.sub_types,
      tags: result.tags,
      type: result.type,
      value,
      widgetId,
    }
    await db.none(
      `
        INSERT INTO values(id, schema_id, value, widget_id)
        VALUES ($<id>, $<schemaId>, $<value:json>, $<widgetId>)
      `,
      typedValue,
    )
    await generateObjectTextSearch(typedValue)
  }
  if (properties) {
    typedValue.propertyByKeyId = {}
    for (let [keyId, valueId] of Object.entries(properties)) {
      assert.strictEqual(typeof keyId, "string")
      assert.strictEqual(typeof valueId, "string")
      typedValue.propertyByKeyId[keyId] = await getOrNewProperty(typedValue.id, keyId, valueId, {inactiveStatementIds,
        userId})
    }
  }
  return typedValue
}


export async function getValue(schemaId, widgetId, value) {
  // Note: getValue may be called before the ID of the symbol "schema:localized-string" is known. So it is not
  // possible to use function getIdFromSymbolOrFail("schema:localized-string").
  let localizedStringSchemaId = idBySymbol["schema:localized-string"]
  let valueClause = localizedStringSchemaId && schemaId === localizedStringSchemaId ?
    "value @> $<value:json>" :
    "value = $<value:json>"
  let widgetClause = widgetId === null || widgetId === undefined ? "widget_id IS NULL" : "widget_id = $<widgetId>"
  return entryToValue(await db.oneOrNone(
    `
      SELECT objects.*, values.*, symbol
      FROM objects
      INNER JOIN values ON objects.id = values.id
      LEFT JOIN symbols ON values.id = symbols.id
      WHERE schema_id = $<schemaId>
      AND ${widgetClause}
      AND ${valueClause}
    `,
    {
      schemaId,
      value,
      widgetId,
    },
  ))
}


export async function newCard({inactiveStatementIds = null, properties = null, userId = null} = {}) {
  if (properties) assert(userId, "Properties can only be set when userId is not null.")

  // Compute object subTypeIds from properties for optimistic optimization.
  let subTypeIds = null
  if (properties) {
    let subTypesId = properties[getIdFromSymbolOrFail("types")]
    if (subTypesId !== undefined) {
      let subTypesValue = await getObjectFromId(subTypesId)
      if (subTypesValue.schemaId === getIdFromSymbolOrFail("schema:type-reference")) {
        subTypeIds = [subTypesValue.value]
      } else if (subTypesValue.schemaId === getIdFromSymbolOrFail("schema:type-references-array")) {
        subTypeIds = subTypesValue.value
      }
    }
  }

  let result = await db.one(
    `
      INSERT INTO objects(created_at, properties, sub_types, type)
      VALUES (current_timestamp, $<properties:json>, $<subTypeIds>, 'Card')
      RETURNING created_at, id, tags, type
    `,
    {
      properties,  // Note: Properties are typically set for optimistic optimization.
      subTypeIds,
    },
  )
  let card = {
    createdAt: result.created_at,
    id: result.id,
    properties,
    subTypeIds,
    tags: result.tags,
    type: result.type,
  }
  result = await db.one(
    `
      INSERT INTO statements(id)
      VALUES ($<id>)
      RETURNING rating, rating_count, rating_sum
    `,
    card,
  )
  Object.assign(card, {
    rating: result.rating,
    ratingCount: result.rating_count,
    ratingSum: result.rating_sum,
  })
  await db.none(
    `
      INSERT INTO cards(id)
      VALUES ($<id>)
    `,
    card,
  )
  await generateObjectTextSearch(card)
  if (userId) {
    await rateStatement(card.id, userId, 1)
  }
  if (properties) {
    card.propertyByKeyId = {}
    for (let [keyId, valueId] of Object.entries(properties)) {
      assert.strictEqual(typeof keyId, "string")
      assert.strictEqual(typeof valueId, "string")
      card.propertyByKeyId[keyId] = await getOrNewProperty(card.id, keyId, valueId, {inactiveStatementIds, userId})
    }
  }

  return card
}


export function ownsUser(user, otherUser) {
  if (!user) return false
  if (user.isAdmin) return true
  return user.id === otherUser.id
}


export {propagateOptimisticOptimization}
async function propagateOptimisticOptimization(statements, statement, oldRating, oldRatingSum) {
  const newRatingCount = statement.ratingCount !== undefined ? statement.ratingCount : 0
  const newRating = newRatingCount > 0 ? statement.rating : 0
  const newRatingSum = newRatingCount > 0 ? statement.ratingSum : 0
  if (oldRating === undefined) oldRating = 0
  if (oldRatingSum === undefined) oldRatingSum = 0

  if (statement.type === "Abuse") {
    if (oldRatingSum <= 0 && newRatingSum > 0 || oldRatingSum > 0 && newRatingSum <= 0) {
      let flaggedStatement = entryToStatement(await db.oneOrNone(
          `SELECT * FROM statements
            WHERE id = $<statementId>`,
          statement,
        ))
      if (flaggedStatement !== null) {
        if (newRatingSum > 0) flaggedStatement.isAbuse = true
        else delete flaggedStatement.isAbuse
        statements.push(flaggedStatement)
      }
    }
  } else if (statement.type === "Argument") {
    if (!statement.isAbuse && ["because", "but"].includes(statement.argumentType)) {
      if ((oldRating > 0) !== (newRating > 0)) {
        let claim = entryToStatement(await db.oneOrNone(
          `SELECT * FROM statements
            WHERE id = $<claimId>`,
          statement,
        ))
        let ground = entryToStatement(await db.oneOrNone(
          `SELECT * FROM statements
            WHERE id = $<groundId>`,
          statement,
        ))
        if (claim !== null && claim.ratingCount && ground !== null && !ground.isAbuse) {
          claim.ratingSum = (claim.ratingSum || 0) +
            ((newRating > 0) - (oldRating > 0)) * (statement.argumentType === "because" ? 1 : -1)
            * (ground.ratingSum || 0)
          claim.ratingSum = Math.max(-claim.ratingCount, Math.min(claim.ratingCount, claim.ratingSum))
          claim.rating = claim.ratingSum / claim.ratingCount
          statements.push(claim)
        }
      }
    }
  }
}


export async function rateStatement(statementId, voterId, rating) {
  let ballot = {
    id: `${statementId}/${voterId}`,
    rating,
    statementId,
    voterId,
  }
  let oldBallot = entryToBallot(await db.oneOrNone(
    "SELECT * FROM ballots WHERE statement_id = $<statementId> AND voter_id = $<voterId>",
    ballot,
  ))
  if (oldBallot === null) {
    let result = await db.one(
      `INSERT INTO ballots(rating, statement_id, updated_at, voter_id)
        VALUES ($<rating>, $<statementId>, current_timestamp, $<voterId>)
        RETURNING updated_at`,
      ballot,
    )
    ballot.updatedAt = result.updated_at
    await addAction(statementId, "rating")
  } else if (rating !== oldBallot.rating) {
    let result = await db.one(
      `UPDATE ballots
        SET rating = $<rating>, updated_at = current_timestamp
        WHERE statement_id = $<statementId> AND voter_id = $<voterId>
        RETURNING updated_at`,
      ballot,
    )
    ballot.updatedAt = result.updated_at
    await addAction(statementId, "rating")
  } else {
    ballot = oldBallot
  }
  return [oldBallot, ballot]
}


// export {toBallotData}
// async function toBallotData(ballot, statements, user, {depth = 0, showAbuse = false, showAuthor = false,
//   showBallot = false, showGrounds = false, showProperties = false, showReferences = false, showTags = false} = {}) {
//   let data = {
//     ballots: {[ballot.id]: toBallotJson(ballot)},
//     id: ballot.id,
//     statements: {},
//     users: {},
//   }
//   let statementsCache = {}
//   for (let statement of statements) {
//     statementsCache[statement.id] = statement
//   }

//   for (let statement of statements) {
//     await toStatementData1(data, statement, statementsCache, user,
//       {depth, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//   }

//   if (Object.keys(data.ballots).length === 0) delete data.ballots
//   if (Object.keys(data.statements).length === 0) delete data.statements
//   if (Object.keys(data.users).length === 0) delete data.users
//   return data
// }


function toBallotJson(ballot) {
  // let ballotJson = {...ballot}
  let ballotJson = Object.assign({}, ballot)
  if (ballotJson.updatedAt) ballotJson.updatedAt = ballotJson.updatedAt.toISOString()
  return ballotJson
}


export async function toDataJson(objectOrObjects, user, {
  depth = 0,
  objectsCache = null,
  showBallots = false,
  showProperties = false,
  showReferences = false,
  showValues = false,
} = {}) {
  objectsCache = objectsCache ? Object.assign({}, objectsCache) : {}
  let data = {
    ballots: {},
    cards: {},
    concepts: {},
    properties: {},
    users: {},
    values: {},
    visitedIds: new Set(),
  }

  if (Array.isArray(objectOrObjects)) {
    data.ids = objectOrObjects.map(object => object.symbol || object.id)
    for (let object of objectOrObjects) {
      await toDataJson1(object, data, objectsCache, user, {depth, showBallots, showProperties, showReferences, showValues})
    }
  } else {
    assert.ok(objectOrObjects)
    data.id = objectOrObjects.symbol || objectOrObjects.id
    await toDataJson1(objectOrObjects, data, objectsCache, user, {depth, showBallots, showProperties, showReferences,
      showValues})
  }

  if (Object.keys(data.ballots).length === 0) delete data.ballots
  if (Object.keys(data.cards).length === 0) delete data.cards
  if (Object.keys(data.concepts).length === 0) delete data.concepts
  if (Object.keys(data.properties).length === 0) delete data.properties
  if (Object.keys(data.users).length === 0) delete data.users
  if (Object.keys(data.values).length === 0) delete data.values
  delete data.visitedIds
  return data
}


async function toDataJson1(idOrObject, data, objectsCache, user, {
  depth = 0,
  showBallots = false,
  showProperties = false,
  showReferences = false,
  showValues = false,
} = {}) {
  let object
  if (typeof idOrObject === "string") {
    if (data.visitedIds.has(idOrObject)) return
    object = await getObjectFromId(idOrObject)
    if (object === null) {
      console.log("Missing object for ID:", idOrObject)
      return
    }
  } else {
    object = idOrObject
    if (object === null) {
      console.log("Missing object")
      return
    }
    if (data.visitedIds.has(object.id)) return
  }
  data.visitedIds.add(object.id)

  const cachedObject = objectsCache[object.id]
  if (cachedObject) object = cachedObject

  const objectJsonBySymbolOrId = {
    Card: data.cards,
    Concept: data.concepts,
    Property: data.properties,
    User: data.users,
    Value: data.values,
  }[object.type]
  assert.notStrictEqual(objectJsonBySymbolOrId, undefined)
  const objectJson = await toObjectJson(object)
  objectJsonBySymbolOrId[object.symbol || object.id] = objectJson

  if (showBallots && user) {
    let ballotJsonById = data.ballots
    let ballotId = [object.id, user.id].join("/")
    objectJson.ballotId = ballotId
    if (!ballotJsonById[ballotId]) {
      let ballot = entryToBallot(await db.oneOrNone(
        "SELECT * FROM ballots WHERE statement_id = $1 AND voter_id = $2",
        [object.id, user.id],
      ))
      if (ballot !== null) ballotJsonById[ballotId] = toBallotJson(ballot)
    }
  }

  if (showReferences && depth > 0) {
    let sourceEntries = await db.any(
      `
        SELECT id, sub_types
        FROM objects
        INNER JOIN objects_references ON id = source_id
        WHERE target_id = $<id>
      `,
      object,
    )
    let targetEntries = await db.any(
      `
        SELECT id, sub_types
        FROM objects
        INNER JOIN objects_references ON id = target_id
        WHERE source_id = $<id>
      `,
      object,
    )

    let referencedIds = new Set([...sourceEntries.map(entry => entry.id), ...targetEntries.map(entry => entry.id)])
    for (let referencedId of referencedIds) {
      await toDataJson1(referencedId, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
        showReferences, showValues})
    }

    let references = {}
    for (let {id, sub_types} of sourceEntries.concat(targetEntries)) {
      for (let subTypeId of sub_types || []) {
        let subTypeReferences = references[subTypeId]
        if (subTypeReferences === undefined) references[subTypeId] = subTypeReferences = new Set()
        subTypeReferences.add(id)
      }
    }
    if (Object.keys(references).length > 0) {
      objectJson.references = {}
      for (let [subTypeId, ids] of Object.entries(references)) {
        objectJson.references[getSymbolOrId(subTypeId)] = [...ids].sort().map(getSymbolOrId)
      }
    }
  }

  if (showValues && depth > 0) {
    if (object.type == "Property") {
      await toDataJson1(object.keyId, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
        showValues})
      await toDataJson1(object.valueId, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
        showValues})
    }

    for (let [keyId, valueId] of Object.entries(object.properties || {})) {
      await toDataJson1(keyId, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
        showValues})
      await toDataJson1(valueId, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
        showValues})
    }

    for (let subTypeId of (object.subTypeIds || [])) {
      await toDataJson1(subTypeId, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
        showValues})
    }
  }
}


export async function toSchemaValueJson(schema, value) {
  if (schema.$ref === "/schemas/bijective-card-reference") {
    return {
      reverseKeyId: getSymbolOrId(value.reverseKeyId),
      targetId: getSymbolOrId(value.targetId),
    }
  } else if (["/schemas/card-reference", "/schemas/type-reference"].includes(schema.$ref)) {
    return getSymbolOrId(value)
  } else if (schema.type === "array") {
    if (Array.isArray(schema.items)) {
      let valueJson = []
      for (let [index, itemSchema] of schema.items.entries()) {
        valueJson.push(await toSchemaValueJson(itemSchema, value[index]))
      }
      return valueJson
    } else {
      let valueJson = []
      for (let itemValue of value) {
        valueJson.push(await toSchemaValueJson(schema.items, itemValue))
      }
      return valueJson
    }
  } else {
    return value
  }
}


export async function toObjectJson(object, {showApiKey = false, showEmail = false} = {}) {
  let objectJson = Object.assign({}, object)
  objectJson.createdAt = objectJson.createdAt.toISOString()
  if (objectJson.properties) {
    let properties = objectJson.properties = Object.assign({}, objectJson.properties)
    for (let [keyId, valueId] of Object.entries(properties)) {
      let keySymbol = getSymbolOrId(keyId)
      properties[keySymbol] = getSymbolOrId(valueId)
      if (keySymbol !== keyId) delete properties[keyId]
    }
  }
  delete objectJson.propertyByKeyId
  if (objectJson.subTypeIds) {
    objectJson.subTypeIds = object.subTypeIds.map(getSymbolOrId)
  }

  if (object.type === "Concept") {
    objectJson.valueId = getSymbolOrId(objectJson.valueId)
  } else if (object.type === "Property") {
    objectJson.objectId = getSymbolOrId(objectJson.objectId)
    objectJson.keyId = getSymbolOrId(objectJson.keyId)
    objectJson.valueId = getSymbolOrId(objectJson.valueId)
  } else if (object.type === "User") {
    if (!showApiKey) delete objectJson.apiKey
    if (!showEmail) delete objectJson.email
    delete objectJson.passwordDigest
    delete objectJson.salt
  } else if (object.type === "Value") {
    objectJson.schemaId = getSymbolOrId(objectJson.schemaId)
    objectJson.widgetId = getSymbolOrId(objectJson.widgetId)
    let schema = (await getObjectFromId(object.schemaId)).value
    objectJson.value = await toSchemaValueJson(schema, objectJson.value)
  }

  for (let [key, value] of Object.entries(objectJson)) {
    if (value === null || value === undefined) delete objectJson[key]
  }

  return objectJson
}


// export {toStatementData}
// async function toStatementData(statement, user, {depth = 0, showAbuse = false, showAuthor = false, showBallot = false,
//   showGrounds = false, showProperties = false, showReferences = false, showTags = false, statements = []} = {}) {
//   let data = {
//     ballots: {},
//     id: statement.id,
//     statements: {},
//     users: {},
//   }
//   let statementsCache = {}
//   for (let statement of statements) {
//     statementsCache[statement.id] = statement
//   }

//   await toStatementData1(data, statement, statementsCache, user,
//     {depth, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})

//   if (Object.keys(data.ballots).length === 0) delete data.ballots
//   if (Object.keys(data.statements).length === 0) delete data.statements
//   if (Object.keys(data.users).length === 0) delete data.users
//   return data
// }


// async function toStatementData1(data, statement, statementsCache, user, {depth = 0, showAbuse = false,
//   showAuthor = false, showBallot = false, showGrounds = false, showProperties = false, showReferences = false,
//   showTags = false} = {}) {
//   let statementJsonById = data.statements
//   if (statementJsonById[statement.id]) return

//   const cachedStatement = statementsCache[statement.id]
//   if (cachedStatement) statement = cachedStatement

//   const statementJson = toStatementJson(statement)
//   statementJsonById[statement.id] = statementJson

//   if (statement.type === "Abuse") {
//     if (statement.statementId) {
//       const flaggedStatement = entryToStatement(await db.oneOrNone(
//         `SELECT * FROM statements
//           WHERE id = $<statementId>`,
//         statement,
//       ))
//       await toStatementData1(data, flaggedStatement, statementsCache, user,
//         {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//     }
//   } else if (statement.type === "Argument") {
//     if (statement.claimId) {
//       const claim = entryToStatement(await db.oneOrNone(
//         `SELECT * FROM statements
//           WHERE id = $<claimId>`,
//         statement,
//       ))
//       await toStatementData1(data, claim, statementsCache, user,
//         {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//     }
//     if (statement.groundId) {
//       const ground = entryToStatement(await db.oneOrNone(
//         `SELECT * FROM statements
//           WHERE id = $<groundId>`,
//         statement,
//       ))
//       await toStatementData1(data, ground, statementsCache, user,
//         {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//     }
//   } else if (statement.type === "Property") {
//     if (statement.statementId) {
//       const statementWithProperties = entryToStatement(await db.oneOrNone(
//         `SELECT * FROM statements
//           WHERE id = $<statementId>`,
//         statement,
//       ))
//       await toStatementData1(data, statementWithProperties, statementsCache, user,
//         {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//     }
//   } else if (statement.type === "Tag") {
//     if (statement.statementId) {
//       const taggedStatement = entryToStatement(await db.oneOrNone(
//         `SELECT * FROM statements
//           WHERE id = $<statementId>`,
//         statement,
//       ))
//       await toStatementData1(data, taggedStatement, statementsCache, user,
//         {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//     }
//   }

//   if (showAbuse) {
//     const abuse = entryToStatement(await db.oneOrNone(
//       `SELECT * FROM statements
//         WHERE (data->>'statementId') = $<id>::text and type = 'Abuse'`,
//       statement,
//     ))
//     statementJson.abuseId = abuse !== null ? abuse.id : null
//     if (depth > 0 && abuse !== null) {
//       await toStatementData1(data, abuse, statementsCache, user,
//         {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//     }
//   }
//   if (showGrounds) {
//     const groundArguments = (await db.any(
//       `SELECT * FROM statements
//         WHERE (data->>'claimId') = $<id>::text`,
//       statement,
//     )).map(entryToStatement)
//     statementJson.groundIds = groundArguments.map(groundArgument => groundArgument.id)
//     if (groundArguments.length > 0 && depth > 0) {
//       for (let groundArgument of groundArguments) {
//         await toStatementData1(data, groundArgument, statementsCache, user,
//           {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//       }
//       const groundStatements = (await db.any(
//         `SELECT * FROM statements
//           WHERE id IN ($1:csv)`,
//         [groundArguments.map(groundArgument => groundArgument.groundId)],
//       )).map(entryToStatement)
//       for (let groundStatement of groundStatements) {
//         await toStatementData1(data, groundStatement, statementsCache, user,
//           {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//       }
//     }
//   }
//   if (showProperties) {
//     const properties = (await db.any(
//       `SELECT * FROM statements
//         WHERE (data->>'statementId') = $<id>::text and type = 'Property'`,
//       statement,
//     )).map(entryToStatement)
//     let activePropertiesIds = properties.reduce(
//       function (ids, property) {
//         if (property.isActive) ids.push(property.id)
//         return ids
//       },
//       [],
//     )
//     if (activePropertiesIds.length > 0) statement.activePropertiesIds = activePropertiesIds
//     let ballotJsonById = data.ballots
//     let userPropertiesIds = []
//     for (let property of properties) {
//       if (user) {
//         let ballotId = [property.id, user.id].join("/")
//         let ballot = ballotJsonById[ballotId]
//         if (!ballot) {
//           ballot = entryToBallot(await db.oneOrNone(
//             "SELECT * FROM ballots WHERE statement_id = $1 AND voter_id = $2",
//             [property.id, user.id],
//           ))
//           if (ballot !== null && showBallot) ballotJsonById[ballotId] = toBallotJson(ballot)
//         }
//         if (ballot !== null) userPropertiesIds.push(property.id)
//       }
//       if (depth > 0 && (activePropertiesIds.includes(property.id) || userPropertiesIds.includes(property.id))) {
//         await toStatementData1(data, property, statementsCache, user,
//           {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//       }
//     }
//     if (userPropertiesIds.length > 0) statement.userPropertiesIds = userPropertiesIds
//   }
//   if (showReferences && depth > 0 && statement.type === "Card") {
//     let referencedIds = new Set()
//     for (let [name, schema] of Object.entries(statement.schemas)) {
//       addReferences(referencedIds, schema, statement.values[name])
//     }
//     if (referencedIds.size > 0) {
//       const references = (await db.any(
//         `SELECT * FROM statements
//           WHERE id IN ($<referencedIds:csv>)`,
//         {
//           referencedIds: [...referencedIds].sort(),
//         },
//       )).map(entryToStatement)
//       for (let reference of references) {
//         await toStatementData1(data, reference, statementsCache, user,
//           {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//       }
//     }
//   }
//   if (showTags) {
//     const tags = (await db.any(
//       `SELECT * FROM statements
//         WHERE (data->>'statementId') = $<id>::text and type = 'Tag'`,
//       statement,
//     )).map(entryToStatement)
//     statementJson.tagIds = tags.map(tag => tag.id)
//     if (depth > 0) {
//       for (let tag of tags) {
//         await toStatementData1(data, tag, statementsCache, user,
//           {depth: depth - 1, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//       }
//     }
//   }

//   if (showAuthor && statement.authorId){
//     let userJsonById = data.users
//     if (!userJsonById[statement.authorId]) {
//       let user = entryToUser(await db.oneOrNone(
//         `SELECT * FROM objects
//           INNER JOIN users ON objects.id = users.id
//           WHERE id = $1
//         `, statement.authorId))
//       if (user !== null) userJsonById[statement.authorId] = toUserJson(user)
//     }
//   }

//   if (showBallot && user) {
//     let ballotJsonById = data.ballots
//     let ballotId = [statement.id, user.id].join("/")
//     statementJson.ballotId = ballotId
//     if (!ballotJsonById[ballotId]) {
//       let ballot = entryToBallot(await db.oneOrNone(
//         "SELECT * FROM ballots WHERE statement_id = $1 AND voter_id = $2",
//         [statement.id, user.id],
//       ))
//       if (ballot !== null) ballotJsonById[ballotId] = toBallotJson(ballot)
//     }
//   }
// }


// export function toStatementJson(statement) {
//   // let statementJson = {...statement}
//   let statementJson = Object.assign({}, statement)
//   statementJson.createdAt = statementJson.createdAt.toISOString()
//   delete statementJson.hash
//   return statementJson
// }


// export {toStatementsData}
// async function toStatementsData(statements, user, {depth = 0, showAbuse = false, showAuthor = false, showBallot = false,
//   showGrounds = false, showProperties = false, showReferences = false, showTags = false} = {}) {
//   let data = {
//     ballots: {},
//     ids: statements.map(statement => statement.id),
//     statements: {},
//     users: {},
//   }
//   let statementsCache = {}
//   for (let statement of statements) {
//     statementsCache[statement.id] = statement
//   }

//   for (let statement of statements) {
//     await toStatementData1(data, statement, statementsCache, user,
//       {depth, showAbuse, showAuthor, showBallot, showGrounds, showProperties, showReferences, showTags})
//   }

//   if (Object.keys(data.ballots).length === 0) delete data.ballots
//   if (Object.keys(data.statements).length === 0) delete data.statements
//   if (Object.keys(data.users).length === 0) delete data.users
//   return data
// }


export {toUserJson}
function toUserJson(user, {showApiKey = false, showEmail = false} = {}) {
  // let userJson = {...user}
  let userJson = Object.assign({}, user)
  if (!showApiKey) delete userJson.apiKey
  if (!showEmail) delete userJson.email
  userJson.createdAt = userJson.createdAt.toISOString()
  // delete userJson.id
  delete userJson.passwordDigest
  delete userJson.salt
  return userJson
}


export async function unrateStatement(statementId, voterId) {
  let ballot = {
    statementId,
    voterId,
  }
  let oldBallot = entryToBallot(await db.oneOrNone(
    "SELECT * FROM ballots WHERE statement_id = $<statementId> AND voter_id = $<voterId>",
    ballot,
  ))
  if (oldBallot !== null) {
    await db.none(
      "DELETE FROM ballots WHERE statement_id = $<statementId> AND voter_id = $<voterId>",
      ballot,
    )
    await addAction(statementId, "rating")
  }
  return oldBallot
}


export const wrapAsyncMiddleware = fn => (...args) => fn(...args).catch(args[2])
