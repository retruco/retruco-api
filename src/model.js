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
import {getIdFromIdOrSymbol, getIdFromSymbol, getIdOrSymbolFromId, getValueFromSymbol, idBySymbol} from "./symbols"


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
  } else if (["/schemas/card-id", "/schemas/value-id"].includes(schema.$ref)) {
    referencedIds.add(value)
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
  }
}


export async function convertValidJsonToTypedValue(schema, widget, value,
  {cache = null, inactiveStatementIds = null, userId = null} = {}) {
  // Convert symbols to IDs, etc.
  let warning = null
  if (schema.$ref === "/schemas/card-id") {
    let id = getIdFromIdOrSymbol(value)
    let object = await getObjectFromId(id)
    if (object === null) return [null, `Unknown ID or symbol: ${value}`]
    if (object.type !== "Card") return [null, `Object with ID or symbol "${value}" is not a card.`]
    value = id
  } else if (schema.$ref === "/schemas/localized-string") {
    let stringIdByLanguageId = {}
    let warnings = {}
    let widgetId = widget === null ? null :
      (await getOrNewValue(getIdFromSymbol("schema:object"), null, widget,
        {cache, inactiveStatementIds, userId})).id
    for (let [language, string] of Object.entries(value)) {
      let languageId = idBySymbol[language]
      if (languageId === undefined) {
        warnings[language] = `Unknown language: ${language}`
        continue
      }
      let stringId = (await getOrNewValue(getIdFromSymbol("schema:string"), widgetId, string,
        {cache, inactiveStatementIds, userId})).id
      stringIdByLanguageId[languageId] = stringId
    }
    value = stringIdByLanguageId
    if (Object.keys(warnings).length > 0) warning = warnings
    if (Object.keys(value).length === 0) return [null, warning]
  } else if (schema.$ref === "/schemas/value-id") {
    let id = getIdFromIdOrSymbol(value)
    let object = await getObjectFromId(id)
    if (object === null) return [null, `Unknown ID or symbol: ${value}`]
    if (object.type !== "Value") return [null, `Object with ID or symbol "${value}" is not a value.`]
    return [object, null]
  } else if (schema.type === "array") {
    let itemIds = []
    let warnings = {}
    for (let [index, item] of value.entries()) {
      let schemaItem = Array.isArray(schema.items) ? schema.items[index] : schema.items
      let [typedItem, itemWarning] = (await convertValidJsonToTypedValue(schemaItem, widget, item,
        {inactiveStatementIds, userId}))
      if (typedItem === null) continue
      itemIds.push(typedItem.id)
      if (itemWarning !== null) warnings[String(index)] = itemWarning
    }
    schema = getValueFromSymbol("schema:value-ids-array")
    value = itemIds
    if (Object.keys(warnings).length > 0) warning = warnings
  }

  let schemaId = (await getOrNewValue(getIdFromSymbol("schema:object"), null, schema,
      {cache, inactiveStatementIds, userId})).id
  let widgetId = widget === null ? null : (await getOrNewValue(getIdFromSymbol("schema:object"), null, widget,
    {cache, inactiveStatementIds, userId})).id
  let typedValue = await getOrNewValue(schemaId, widgetId, value, {cache, inactiveStatementIds, userId})
  return [typedValue, warning]
}


export async function describe(object) {
  if (object === null) return "missing object"
  const type = object.type
  if (type === "Card") {
    return `card @${object.id}`
  } else if (type === "Concept") {
    const valueDescription = await describe(await getObjectFromId(object.valueId))
    return `concept @${object.id} based on ${valueDescription}`
  } else if (type === "Property") {
    const keyDescription = await describe(await getObjectFromId(object.keyId))
    const objectDescription = await describe(await getObjectFromId(object.objectId))
    const valueDescription = await describe(await getObjectFromId(object.valueId))
    return `property @${object.id} of ${objectDescription}: ${keyDescription} = ${valueDescription}`
  } else if (type === "User") {
    return `user @${object.id}  ${object.name} <${object.email}>`
  } else if (type === "Value") {
    let typedSchema = await getObjectFromId(object.schemaId)
    let valueJson = await toSchemaValueJson(typedSchema.value, object.value)
    return `value @${object.id} ${JSON.stringify(valueJson)}`
  } else {
    return `object @${object.id} of unknown type ${type}`
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
    tagIds: entry.tags,
    type: entry.type,
    usageIds: entry.usages,
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
  let autocompleteByLanguage = {}
  let englishId = getIdFromSymbol("en")
  let languages = []
  let searchableTextsByWeightByLanguage = {}
  let table = null
  if (object.type === "Card") {
    table = "cards"
    languages = config.languages
    let valueIdByKeyId = object.properties
    if (valueIdByKeyId) {
      for (let language of languages) {
        let autocomplete = null
        let languageId = getIdFromSymbol(language)
        for (let keySymbol of ["name", "title"]) {
          let valueId = valueIdByKeyId[getIdFromSymbol(keySymbol)]
          if (valueId !== undefined) {
            let value = await getObjectFromId(valueId)
            assert.ok(value, `Missing value at ID ${valueId}`)
            let text = await getLanguageText(languageId, englishId, value)
            if (text === null) continue
            autocomplete = text
            break
          }
        }
        for (let keySymbol of ["twitter-name"]) {
          let valueId = valueIdByKeyId[getIdFromSymbol(keySymbol)]
          if (valueId !== undefined) {
            let value = await getObjectFromId(valueId)
            assert.ok(value, `Missing value at ID ${valueId}`)
            let text = await getLanguageText(languageId, englishId, value)
            if (text === null) continue
            autocomplete = autocomplete ? `${autocomplete} (${text})` : `(${text})`
            break
          }
        }
        autocompleteByLanguage[language] = autocomplete ? `${autocomplete} #${object.id}` : `#${object.id}`
      }
      for (let [keySymbol, weight] of [
          ["description", "B"],
          ["name", "A"],
          ["title", "A"],
          ["twitter-name", "A"],
        ]) {
        let valueId = valueIdByKeyId[getIdFromSymbol(keySymbol)]
        if (valueId === undefined) continue
        let value = await getObjectFromId(valueId)
        assert.ok(value, `Missing value at ID ${valueId}`)
        if (value.schemaId === getIdFromSymbol("schema:localized-string")) {
          for (let language of languages) {
            let languageId = getIdFromSymbol(language)
            let text = await getLanguageText(languageId, englishId, value)
            if (text === null) continue
            let searchableTextsByWeight = searchableTextsByWeightByLanguage[language]
            if (searchableTextsByWeight === undefined) {
              searchableTextsByWeightByLanguage[language] = searchableTextsByWeight = {}
            }
            let searchableTexts = searchableTextsByWeight[weight]
            if (searchableTexts === undefined) searchableTextsByWeight[weight] = searchableTexts = []
            searchableTexts.push(text)
          }
        }
      }
    }
  } else if (object.type === "Concept") {
    table = "concepts"
    for (let language of languages) {
      autocompleteByLanguage[language] = String(object.value)
    }
    // languageConfigurationNames = [languageConfigurationNameByCode[object.language]]
    languages = config.languages
    // TODO: searchableTextsByLanguage
  } else if (object.type === "Value") {
    table = "values"
    for (let language of languages) {
      autocompleteByLanguage[language] = String(object.value)
    }
    // languageConfigurationNames = [languageConfigurationNameByCode[object.language]]
    languages = config.languages
    // TODO: searchableTextsByLanguage
  } else if (object.type === "User") {
    table = "users"
    for (let language of languages) {
      autocompleteByLanguage[language] = `${object.name} <${object.email}>`
    }
    // languageConfigurationNames = [languageConfigurationNameByCode[object.language]]
    languages = config.languages
    for (let language of languages) {
      for (let text of [
        object.name,
        object.email,
      ]) {
        if (text) {
          let searchableTextsByWeight = searchableTextsByWeightByLanguage[language]
          if (searchableTextsByWeight === undefined) {
            searchableTextsByWeightByLanguage[language] = searchableTextsByWeight = {}
          }
          let searchableTexts = searchableTextsByWeight["A"]
          if (searchableTexts === undefined) searchableTextsByWeight["A"] = searchableTexts = []
          searchableTexts.push(text)
        }
      }
    }
  }

  if (table) {
    if (Object.keys(autocompleteByLanguage).length === 0) {
      await db.none(`DELETE FROM ${table}_autocomplete WHERE id = $1`, object.id)
    } else {
      for (let [language, autocomplete] of Object.entries(autocompleteByLanguage)) {
        let languageConfigurationName = languageConfigurationNameByCode[language]
        assert.ok(languageConfigurationName, language)
        await db.none(
          `INSERT INTO ${table}_autocomplete(id, configuration_name, autocomplete)
            VALUES ($1, $2, $3)
            ON CONFLICT (id, configuration_name)
            DO UPDATE SET autocomplete = $3
          `,
          [object.id, languageConfigurationName, autocomplete],
        )
      }
      let languageConfigurationNames = Object.keys(autocompleteByLanguage).map(
        language => languageConfigurationNameByCode[language])
      await db.none(
        `DELETE FROM ${table}_autocomplete WHERE id = $1 AND configuration_name NOT IN ($2:csv)`,
        [object.id, languageConfigurationNames],
      )
    }

    if (Object.keys(searchableTextsByWeightByLanguage).length === 0) {
      await db.none(`DELETE FROM ${table}_text_search WHERE id = $1`, object.id)
    } else {
      for (let [language, searchableTextsByWeight] of Object.entries(searchableTextsByWeightByLanguage)) {
        let languageConfigurationName = languageConfigurationNameByCode[language]
        assert.ok(languageConfigurationName, language)
        let searchableTextByWeight = {
          A: (searchableTextsByWeight["A"] || []).join(" "),
          B: (searchableTextsByWeight["B"] || []).join(" "),
        }
        await db.none(
          `INSERT INTO ${table}_text_search(id, configuration_name, text_search)
            VALUES ($1, $2, setweight(to_tsvector($2, $3), 'A') || setweight(to_tsvector($2, $4), 'B'))
            ON CONFLICT (id, configuration_name)
            DO UPDATE SET text_search = setweight(to_tsvector($2, $3), 'A') || setweight(to_tsvector($2, $4), 'B')
          `,
          [object.id, languageConfigurationName, searchableTextByWeight["A"], searchableTextByWeight["B"]],
        )
      }
      let languageConfigurationNames = Object.keys(searchableTextsByWeightByLanguage).map(
        language => languageConfigurationNameByCode[language])
      await db.none(
        `DELETE FROM ${table}_text_search WHERE id = $1 AND configuration_name NOT IN ($2:csv)`,
        [object.id, languageConfigurationNames],
      )
    }
  }
}


async function getLanguageText(languageId, defaultLanguageId, typedValue) {
  if (typedValue.schemaId === getIdFromSymbol("schema:localized-string")) {
    let textId = typedValue.value[languageId]
    if (textId === undefined) textId = typedValue.value[defaultLanguageId]
    if (textId === undefined) textId = Object.values(typedValue.value)[0]
    if (textId === undefined) return null
    let typedText = await getObjectFromId(textId)
    if (typedText === null) return null
    return typedText.value
  } else if (typedValue.schemaId === getIdFromSymbol("schema:string")) {
    return typedValue.value
  } else {
    return String(typedValue.value)
  }
}

export async function getObjectFromId(id) {
  assert.ok(id)
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


export async function getOrNewLocalizedString(language, string, widgetIdOrSymbolFromId,
  {cache = null, inactiveStatementIds = null, properties = null, userId = null} = {}) {
  assert.strictEqual(typeof string, "string")
  let widgetId = getIdFromIdOrSymbol(widgetIdOrSymbolFromId)
  let stringId = (await getOrNewValue(getIdFromSymbol("schema:string"), widgetId, string,
    {cache, inactiveStatementIds, userId})).id
  let localizedString = {
    [getIdFromSymbol(language)]: stringId,
  }
  return await getOrNewValue(
    getIdFromSymbol("schema:localized-string"),
    widgetId,
    localizedString,
    {
      cache,
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

  // TODO: Remove ? Split arrays into atomic properties.
  let typedValue = await getObjectFromId(valueId)
  if (typedValue.schemaId === getIdFromSymbol("schema:value-ids-array")) {
    assert(properties === null)
    let splitProperties = []
    for (let itemId of typedValue.value) {
      splitProperties.push(await getOrNewProperty(objectId, keyId, itemId, {inactiveStatementIds, properties, userId}))
    }
    return splitProperties
  }

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
        RETURNING created_at, id, properties, sub_types, tags, type, usages
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
      tagIds: result.tags,
      type: result.type,
      usageIds: result.usages,
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
    await rateStatement(property, userId, 1)
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


export async function getOrNewValue(schemaId, widgetId, value, {cache = null, inactiveStatementIds = null,
  properties = null, userId = null} = {}) {
  assert(typeof schemaId === "string")
  if (properties) assert(userId, "Properties can only be set when userId is not null.")

  let cacheKey
  if (cache !== null) {
    cacheKey =  JSON.stringify({schemaId, type: "Value", value, widgetId})
    let cacheValue = cache[cacheKey]
    if (cacheValue !== undefined) return cacheValue
  }

  // Note: getOrNewValue may be called before the ID of the symbol "schema:localized-string" is known. So it is not
  // possible to use function getIdFromSymbol("schema:localized-string").
  let localizedStringSchemaId = idBySymbol["schema:localized-string"]
  if (localizedStringSchemaId && schemaId === localizedStringSchemaId) {
    // A localized string contains its value in its properties
    if (!properties) properties = {}
    Object.assign(properties, value)
  }

  let typedValue = await getValue(schemaId, widgetId, value)
  if (typedValue === null) {
    let result = await db.one(
      `
        INSERT INTO objects(created_at, properties, type)
        VALUES (current_timestamp, $<properties:json>, 'Value')
        RETURNING created_at, id, properties, sub_types, tags, type, usages
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
      tagIds: result.tags,
      type: result.type,
      usageIds: result.usages,
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

  if (cache !== null) {
    cache[cacheKey] = typedValue
  }
  return typedValue
}


export async function getSubTypeIdsFromProperties(properties) {
  let subTypeIds = null
  if (properties) {
    let subTypesId = properties[getIdFromSymbol("types")]
    if (subTypesId !== undefined) {
      let subTypesTypedValue = await getObjectFromId(subTypesId)
      if (subTypesTypedValue.schemaId === getIdFromSymbol("schema:localized-string")) {
        subTypeIds = [subTypesId]
      } else if (subTypesTypedValue.schemaId === getIdFromSymbol("schema:value-ids-array")) {
        subTypeIds = new Set()
        for (let itemId of subTypesTypedValue.value) {
          let typedItem = await getObjectFromId(itemId)
          if (typedItem.schemaId === getIdFromSymbol("schema:localized-string")) {
            subTypeIds.add(itemId)
          }
        }
        subTypeIds = [...subTypeIds].sort()
        if (subTypeIds.length === 0) subTypeIds = null
      }
    }
  }
  return subTypeIds
}


export async function getTagIdsFromProperties(properties) {
  let tagIds = null
  if (properties) {
    let tagsId = properties[getIdFromSymbol("tags")]
    if (tagsId !== undefined) {
      let tagsTypedValue = await getObjectFromId(tagsId)
      if (tagsTypedValue.schemaId === getIdFromSymbol("schema:localized-string")) {
        tagIds = [tagsId]
      } else if (tagsTypedValue.schemaId === getIdFromSymbol("schema:value-ids-array")) {
        tagIds = new Set()
        for (let itemId of tagsTypedValue.value) {
          let typedItem = await getObjectFromId(itemId)
          if (typedItem.schemaId === getIdFromSymbol("schema:localized-string")) {
            tagIds.add(itemId)
          }
        }
        tagIds = [...tagIds].sort()
        if (tagIds.length === 0) tagIds = null
      }
    }
  }
  return tagIds
}


export async function getValue(schemaId, widgetId, value) {
  // Note: getValue may be called before the ID of the symbol "schema:localized-string" is known. So it is not
  // possible to use function getIdFromSymbol("schema:localized-string").
  let localizedStringSchemaId = idBySymbol["schema:localized-string"]
  let valueClause = localizedStringSchemaId && schemaId === localizedStringSchemaId ?
    "value @> $<value:json>" :
    "value = $<value:json>"
  // Note: The ORDER BY objects.id LIMIT 1 is a tentative to reduce the number of used duplicate values.
  return entryToValue(await db.oneOrNone(
    `
      SELECT objects.*, values.*, symbol
      FROM objects
      INNER JOIN values ON objects.id = values.id
      LEFT JOIN symbols ON values.id = symbols.id
      WHERE schema_id = $<schemaId>
      AND ${valueClause}
      ORDER BY objects.id
      LIMIT 1
    `,
    {
      schemaId,
      value,
    },
  ))
}


export async function newCard({inactiveStatementIds = null, properties = null, userId = null} = {}) {
  if (properties) assert(userId, "Properties can only be set when userId is not null.")

  // Compute object subTypeIds from properties for optimistic optimization.
  let subTypeIds = await getSubTypeIdsFromProperties(properties)

  // Compute object tagIds from properties for optimistic optimization.
  let tagIds = await getTagIdsFromProperties(properties)

  let result = await db.one(
    `
      INSERT INTO objects(created_at, properties, sub_types, tags, type)
      VALUES (current_timestamp, $<properties:json>, $<subTypeIds>, $<tagIds>, 'Card')
      RETURNING created_at, id, type, usages
    `,
    {
      properties,  // Note: Properties are typically set for optimistic optimization.
      subTypeIds,
      tagIds,
    },
  )
  let card = {
    createdAt: result.created_at,
    id: result.id,
    properties,
    subTypeIds,
    tagIds,
    type: result.type,
    usageIds: result.usages,
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
    await rateStatement(card, userId, 1)
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
  // const newRatingCount = statement.ratingCount !== undefined ? statement.ratingCount : 0
  // const newRating = newRatingCount > 0 ? statement.rating : 0
  // const newRatingSum = newRatingCount > 0 ? statement.ratingSum : 0
  // if (oldRating === undefined) oldRating = 0
  // if (oldRatingSum === undefined) oldRatingSum = 0

  // if (statement.type === "Abuse") {
  //   if (oldRatingSum <= 0 && newRatingSum > 0 || oldRatingSum > 0 && newRatingSum <= 0) {
  //     let flaggedStatement = entryToStatement(await db.oneOrNone(
  //         `SELECT * FROM statements
  //           WHERE id = $<statementId>`,
  //         statement,
  //       ))
  //     if (flaggedStatement !== null) {
  //       if (newRatingSum > 0) flaggedStatement.isAbuse = true
  //       else delete flaggedStatement.isAbuse
  //       statements.push(flaggedStatement)
  //     }
  //   }
  // } else if (statement.type === "Argument") {
  //   if (!statement.isAbuse && ["because", "but"].includes(statement.argumentType)) {
  //     if ((oldRating > 0) !== (newRating > 0)) {
  //       let claim = entryToStatement(await db.oneOrNone(
  //         `SELECT * FROM statements
  //           WHERE id = $<claimId>`,
  //         statement,
  //       ))
  //       let ground = entryToStatement(await db.oneOrNone(
  //         `SELECT * FROM statements
  //           WHERE id = $<groundId>`,
  //         statement,
  //       ))
  //       if (claim !== null && claim.ratingCount && ground !== null && !ground.isAbuse) {
  //         claim.ratingSum = (claim.ratingSum || 0) +
  //           ((newRating > 0) - (oldRating > 0)) * (statement.argumentType === "because" ? 1 : -1)
  //           * (ground.ratingSum || 0)
  //         claim.ratingSum = Math.max(-claim.ratingCount, Math.min(claim.ratingCount, claim.ratingSum))
  //         claim.rating = claim.ratingSum / claim.ratingCount
  //         statements.push(claim)
  //       }
  //     }
  //   }
  // }
}


export async function rateStatement(statement, voterId, rating) {
  assert.ok(statement)
  assert.notStrictEqual(typeof statement, "string")
  let [oldBallot, ballot] = await rateStatementId(statement.id, voterId, rating)
  // Optimistic optimizations
  // const statements = []  // TODO: statements should be a parameter of rateStatement.
  // const oldRating = statement.rating
  // const oldRatingSum = statement.ratingSum
  // statements.push(statement)
  if (oldBallot === null) statement.ratingCount += 1
  statement.ratingSum += ballot.rating - (oldBallot === null ? 0 : oldBallot.rating)
  statement.ratingSum = Math.max(-statement.ratingCount, Math.min(statement.ratingCount, statement.ratingSum))
  statement.rating = statement.ratingSum / statement.ratingCount
  // await propagateOptimisticOptimization(statements, statement, oldRating, oldRatingSum)
  return [oldBallot, ballot]
}


export async function rateStatementId(statementId, voterId, rating) {
  assert.strictEqual(typeof statementId, "string")
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


export {toBallotData}
async function toBallotData(ballot, statementOrStatements, user, {
  depth = 0,
  objectsCache = null,
  showBallots = false,
  showProperties = false,
  showReferences = false,
  showValues = false,
} = {}) {
  objectsCache = objectsCache ? Object.assign({}, objectsCache) : {}
  let data = {
    ballots: {[ballot.id]: toBallotJson(ballot)},
    cards: {},
    concepts: {},
    id: ballot.id,
    properties: {},
    users: {},
    values: {},
    visitedIds: new Set(),
  }

  if (statementOrStatements !== null) {
    if (Array.isArray(statementOrStatements)) {
      for (let object of statementOrStatements) {
        await toDataJson1(object, data, objectsCache, user, {depth, showBallots, showProperties, showReferences,
          showValues})
      }
    } else {
      assert.ok(statementOrStatements)
      await toDataJson1(statementOrStatements, data, objectsCache, user, {depth, showBallots, showProperties,
        showReferences, showValues})
    }
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

  if (objectOrObjects !== null) {
    if (Array.isArray(objectOrObjects)) {
      data.ids = objectOrObjects.map(object => object.symbol || object.id)
      for (let object of objectOrObjects) {
        await toDataJson1(object, data, objectsCache, user, {depth, showBallots, showProperties, showReferences,
          showValues})
      }
    } else {
      assert.ok(objectOrObjects)
      data.id = objectOrObjects.symbol || objectOrObjects.id
      await toDataJson1(objectOrObjects, data, objectsCache, user, {depth, showBallots, showProperties, showReferences,
        showValues})
    }
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

  const objectJsonByIdOrSymbol = {
    Card: data.cards,
    Concept: data.concepts,
    Property: data.properties,
    User: data.users,
    Value: data.values,
  }[object.type]
  assert.notStrictEqual(objectJsonByIdOrSymbol, undefined)
  const objectJson = await toObjectJson(object)
  objectJsonByIdOrSymbol[object.symbol || object.id] = objectJson

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
        AND type = 'Card'
      `,
      object,
    )
    let targetEntries = await db.any(
      `
        SELECT id, sub_types
        FROM objects
        INNER JOIN objects_references ON id = target_id
        WHERE source_id = $<id>
        AND type = 'Card'
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
        objectJson.references[getIdOrSymbolFromId(subTypeId)] = [...ids].sort().map(getIdOrSymbolFromId)
      }
    }
  }

  if (showValues && depth > 0) {
    if (object.type == "Property") {
      await toDataJson1(object.keyId, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
        showValues})
      await toDataJson1(object.valueId, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
        showValues})
    } else if (object.type == "Value") {
      if (object.schemaId === getIdFromSymbol("schema:bijective-card-reference")) {
        await toDataJson1(object.value.reverseKeyId, data, objectsCache, user, {depth: depth - 1, showBallots,
          showProperties, showValues})
        await toDataJson1(object.value.targetId, data, objectsCache, user, {depth: depth - 1, showBallots,
          showProperties, showValues})
      } else if (object.schemaId === getIdFromSymbol("schema:card-id")) {
        await toDataJson1(object.value, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
          showValues})
      } else if ([
          getIdFromSymbol("schema:card-ids-array"),
          getIdFromSymbol("schema:value-ids-array"),
        ].includes(object.schemaId)) {
        for (let itemId of (object.value)) {
          await toDataJson1(itemId, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
            showValues})
        }
      }
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

    for (let tagId of (object.tagIds || [])) {
      await toDataJson1(tagId, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
        showValues})
    }

    for (let usageId of (object.usageIds || [])) {
      await toDataJson1(usageId, data, objectsCache, user, {depth: depth - 1, showBallots, showProperties,
        showValues})
    }
  }
}


export async function toSchemaValueJson(schema, value) {
  if (schema.$ref === "/schemas/bijective-card-reference") {
    return {
      reverseKeyId: getIdOrSymbolFromId(value.reverseKeyId),
      targetId: getIdOrSymbolFromId(value.targetId),
    }
  } else if (schema.$ref === "/schemas/card-id") {
    return getIdOrSymbolFromId(value)
  } else if (schema.$ref === "/schemas/localized-string") {
    let stringByLanguage = {}
    for (let [languageId, stringId] of Object.entries(value)) {
      let language = getIdOrSymbolFromId(languageId)
      let typedString = await getObjectFromId(stringId)
      stringByLanguage[language] = typedString.value
    }
    return stringByLanguage
  } else if (schema.$ref === "/schemas/value-id") {
    return getIdOrSymbolFromId(value)
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
      let keySymbol = getIdOrSymbolFromId(keyId)
      properties[keySymbol] = getIdOrSymbolFromId(valueId)
      if (keySymbol !== keyId) delete properties[keyId]
    }
  }
  delete objectJson.propertyByKeyId
  if (objectJson.subTypeIds) {
    objectJson.subTypeIds = object.subTypeIds.map(getIdOrSymbolFromId)
  }
  if (objectJson.usageIds) {
    objectJson.usageIds = object.usageIds.map(getIdOrSymbolFromId)
  }
  if (objectJson.tagIds) {
    let usageIds = objectJson.usageIds || []
    // Remove usage tags from tags. Usage tags are merged with tags for indexation, but they should not be exported to
    // UI.
    let tagIds = object.tagIds.map(getIdOrSymbolFromId).filter(tagId => !usageIds.includes(tagId))
    if (tagIds.length > 0) {
      objectJson.tagIds = tagIds
    }
  }

  if (object.type === "Concept") {
    objectJson.valueId = getIdOrSymbolFromId(objectJson.valueId)
  } else if (object.type === "Property") {
    objectJson.objectId = getIdOrSymbolFromId(objectJson.objectId)
    objectJson.keyId = getIdOrSymbolFromId(objectJson.keyId)
    objectJson.valueId = getIdOrSymbolFromId(objectJson.valueId)
  } else if (object.type === "User") {
    if (!showApiKey) delete objectJson.apiKey
    if (!showEmail) delete objectJson.email
    delete objectJson.passwordDigest
    delete objectJson.salt
  } else if (object.type === "Value") {
    objectJson.schemaId = getIdOrSymbolFromId(objectJson.schemaId)
    objectJson.widgetId = getIdOrSymbolFromId(objectJson.widgetId)
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


export async function unrateStatement(statement, voterId) {
  assert.ok(statement)
  assert.notStrictEqual(typeof statement, "string")
  let oldBallot = await unrateStatementId(statement.id, voterId)
  // Optimistic optimizations
  if (statement.ratingCount > 0) {
    // const oldRating = statement.rating
    // const oldRatingSum = statement.ratingSum
    // statements.push(statement)
    statement.ratingCount -= 1
    if (statement.ratingCount === 0) {
      statement.rating = 0
      statement.ratingSum = 0
    } else {
      statement.ratingSum -= oldBallot.rating
      statement.ratingSum = Math.max(-statement.ratingCount, Math.min(statement.ratingCount, statement.ratingSum))
      statement.rating = statement.ratingSum / statement.ratingCount
    }
    // await propagateOptimisticOptimization(statements, statement, oldRating, oldRatingSum)
  }
  return oldBallot
}


export async function unrateStatementId(statementId, voterId) {
  assert.strictEqual(typeof statementId, "string")
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
