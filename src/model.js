// Retruco-API -- HTTP API to bring out shared positions from argumented statements
// By: Paula Forteza <paula@retruco.org>
//     Emmanuel Raviart <emmanuel@retruco.org>
//
// Copyright (C) 2016, 2017 Paula Forteza & Emmanuel Raviart
// https://framagit.org/retruco/retruco-api
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
import urlJoin from "url-join"

import config from "./config"
import { db } from "./database"
import { getIdFromIdOrSymbol, getIdFromSymbol, getIdOrSymbolFromId, getValueFromSymbol } from "./symbols"

const configLanguages = config.languages
const configLanguageIds = new Set(configLanguages.map(getIdFromSymbol))

export const languageConfigurationNameByCode = {
  bg: "simple",
  cs: "simple",
  da: "danish",
  de: "german",
  el: "simple",
  en: "english",
  es: "spanish",
  et: "simple",
  fi: "finnish",
  fr: "french",
  ga: "simple",
  hr: "simple",
  hu: "hungarian",
  it: "italian",
  lt: "simple",
  lv: "simple",
  mt: "simple",
  nl: "dutch",
  pl: "simple",
  pt: "portuguese",
  ro: "romanian",
  sk: "simple",
  sl: "simple",
  sv: "swedish",
}

export const languagesSetIdByLanguages = {}

export const types = ["Card", "Property", "User", "Value"]

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

export async function addReferences(referencedIds, schema, value) {
  if (schema.$ref === "/schemas/id") {
    referencedIds.add(value)
  } else if (schema.type === "array") {
    if (Array.isArray(schema.items)) {
      for (let [index, itemSchema] of schema.items.entries()) {
        await addReferences(referencedIds, itemSchema, value[index])
      }
    } else {
      for (let itemValue of value) {
        await addReferences(referencedIds, schema.items, itemValue)
      }
    }
  }
}

export async function convertValidJsonToExistingOrNewTypedValue(
  schema,
  widget,
  value,
  { cache = null, inactiveStatementIds = null, userId = null } = {},
) {
  // The function tries to create typed value when it doesn't exist (it is not always possible, for example for type
  // card-id, id, property-id & value-id).

  // Convert symbols to IDs, etc.
  let warning = {}
  if (schema.$ref === "/schemas/card-id") {
    let id = getIdFromIdOrSymbol(value)
    let object = await getObjectFromId(id)
    if (object === null) {
      warning["value"] = `Unknown ID or symbol: ${value}`
      return [null, warning]
    }
    if (object.type !== "Card") {
      warning["value"] = `Object with ID or symbol "${value}" is not a card.`
      return [null, warning]
    }
    return [object, null]
  } else if (schema.$ref === "/schemas/id") {
    let id = getIdFromIdOrSymbol(value)
    let object = await getObjectFromId(id)
    if (object === null) {
      warning["value"] = `Unknown ID or symbol: ${value}`
      return [null, warning]
    }
    return [object, null]
  } else if (schema.$ref === "/schemas/property-id") {
    let id = getIdFromIdOrSymbol(value)
    let object = await getObjectFromId(id)
    if (object === null) {
      warning["value"] = `Unknown ID or symbol: ${value}`
      return [null, warning]
    }
    if (object.type !== "Property") {
      warning["value"] = `Object with ID or symbol "${value}" is not a property.`
      return [null, warning]
    }
    return [object, null]
  } else if (schema.$ref === "/schemas/value-id") {
    let id = getIdFromIdOrSymbol(value)
    let object = await getObjectFromId(id)
    if (object === null) {
      warning["value"] = `Unknown ID or symbol: ${value}`
      return [null, warning]
    }
    if (object.type !== "Value") {
      warning["value"] = `Object with ID or symbol "${value}" is not a value.`
      return [null, warning]
    }
    return [object, null]
  } else if (schema.type === "array") {
    let itemIds = []
    let warningByItemIndex = {}
    for (let [index, item] of value.entries()) {
      let schemaItem = Array.isArray(schema.items) ? schema.items[index] : schema.items
      let [typedItem, itemWarning] = await convertValidJsonToExistingOrNewTypedValue(schemaItem, widget, item, {
        cache,
        inactiveStatementIds,
        userId,
      })
      if (typedItem === null) continue
      itemIds.push(typedItem.id)
      if (itemWarning !== null) warningByItemIndex[String(index)] = itemWarning
    }
    schema = getValueFromSymbol("schema:ids-array")
    value = itemIds
    if (Object.keys(warningByItemIndex).length > 0) warning["value"] = warningByItemIndex
  }

  let schemaId = (await getOrNewValue(getIdFromSymbol("schema:object"), null, schema, {
    cache,
    inactiveStatementIds,
    userId,
  })).id
  let widgetId =
    widget === null
      ? null
      : (await getOrNewValue(getIdFromSymbol("schema:object"), null, widget, { cache, inactiveStatementIds, userId }))
          .id
  let typedValue = await getOrNewValue(schemaId, widgetId, value, { cache, inactiveStatementIds, userId })
  return [typedValue, Object.keys(warning).length === 0 ? null : warning]
}

export async function convertValidJsonToExistingTypedValue(schema, widget, value) {
  // Convert symbols to IDs, etc.
  let warning = {}
  let widgetId = null
  if (schema.$ref === "/schemas/card-id") {
    let id = getIdFromIdOrSymbol(value)
    let object = await getObjectFromId(id)
    if (object === null) {
      warning["value"] = `Unknown ID or symbol: ${value}`
      return [null, warning]
    }
    if (object.type !== "Card") {
      warning["value"] = `Object with ID or symbol "${value}" is not a card.`
      return [null, warning]
    }
    return [object, null]
  } else if (schema.$ref === "/schemas/id") {
    let id = getIdFromIdOrSymbol(value)
    let object = await getObjectFromId(id)
    if (object === null) {
      warning["value"] = `Unknown ID or symbol: ${value}`
      return [null, warning]
    }
    return [object, null]
  } else if (schema.$ref === "/schemas/property-id") {
    let id = getIdFromIdOrSymbol(value)
    let object = await getObjectFromId(id)
    if (object === null) {
      warning["value"] = `Unknown ID or symbol: ${value}`
      return [null, warning]
    }
    if (object.type !== "Property") {
      warning["value"] = `Object with ID or symbol "${value}" is not a property.`
      return [null, warning]
    }
    return [object, null]
  } else if (schema.$ref === "/schemas/value-id") {
    let id = getIdFromIdOrSymbol(value)
    let object = await getObjectFromId(id)
    if (object === null) {
      warning["value"] = `Unknown ID or symbol: ${value}`
      return [null, warning]
    }
    if (object.type !== "Value") {
      warning["value"] = `Object with ID or symbol "${value}" is not a value.`
      return [null, warning]
    }
    return [object, null]
  } else if (schema.type === "array") {
    let itemIds = []
    let warningByItemIndex = {}
    for (let [index, item] of value.entries()) {
      let schemaItem = Array.isArray(schema.items) ? schema.items[index] : schema.items
      let [typedItem, itemWarning] = await convertValidJsonToExistingTypedValue(schemaItem, widget, item)
      if (typedItem === null) continue
      itemIds.push(typedItem.id)
      if (itemWarning !== null) warningByItemIndex[String(index)] = itemWarning
    }
    schema = getValueFromSymbol("schema:ids-array")
    value = itemIds
    if (Object.keys(warningByItemIndex).length > 0) warning["value"] = warningByItemIndex
  }

  let schemaId = (await getValue(getIdFromSymbol("schema:object"), null, schema)).id
  if (widget !== null) {
    let typedWidget = await getValue(getIdFromSymbol("schema:object"), null, widget)
    if (typedWidget === null) warning["widget"] = `Unknown widget: ${widget}`
    else widgetId = typedWidget.id
  }
  let typedValue = await getValue(schemaId, widgetId, value)
  return [typedValue, Object.keys(warning).length === 0 ? null : warning]
}

export async function describe(object) {
  if (object === null) return "missing object"
  const type = object.type
  if (type === "Card") {
    return `card @${object.id}`
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

export async function describeHtml(object, { withLink = true } = {}) {
  if (object === null) return "<i>Missing object</i>"
  let description
  const type = object.type
  if (type === "Card") {
    description = `<i>Card</i> @${object.id}`
  } else if (type === "Property") {
    const keyDescription = await describeHtml(await getObjectFromId(object.keyId), { withLink: false })
    const objectDescription = await describeHtml(await getObjectFromId(object.objectId), { withLink: false })
    const valueDescription = await describeHtml(await getObjectFromId(object.valueId), { withLink: false })
    description = `<i>Property</i> ${objectDescription}: ${keyDescription} = ${valueDescription}`
  } else if (type === "User") {
    description = `<i>User</i> @${object.id}  ${object.name} <${object.email}>`
  } else if (type === "Value") {
    let typedSchema = await getObjectFromId(object.schemaId)
    let valueJson = await toSchemaValueJson(typedSchema.value, object.value)
    description = `${JSON.stringify(valueJson)}`
  } else {
    description = `<i>Object</i> @${object.id} of unknown type ${type}`
    withLink = false
  }
  if (withLink) {
    let objectsUrlName = type === "Card" ? "cards" : type === "Property" ? "properties" : "values"
    let url = urlJoin(config.ui.url, "en", objectsUrlName, object.id)
    description = `<a href="${url}">${description}</a>`
  }
  return description
}

export function entryToAction(entry) {
  return entry === null
    ? null
    : {
        createdAt: entry.created_at,
        id: entry.id, // Use string for id.
        objectId: entry.object_id,
        type: entry.type,
      }
}

export function entryToBallot(entry) {
  return entry === null
    ? null
    : {
        id: `${entry.statement_id}/${entry.voter_id}`,
        rating: parseInt(entry.rating),
        statementId: entry.statement_id,
        updatedAt: entry.updated_at,
        voterId: entry.voter_id,
      }
}

export function entryToCard(entry) {
  return entry === null ? null : { ...entryToStatement(entry) }
}

export function entryToProperty(entry) {
  return entry === null
    ? null
    : {
        ...entryToStatement(entry),
        keyId: entry.key_id,
        objectId: entry.object_id,
        valueId: entry.value_id,
      }
}

export function entryToObject(entry) {
  return entry === null
    ? null
    : {
        createdAt: entry.created_at,
        id: entry.id,
        properties: entry.properties,
        subTypeIds: entry.sub_types,
        symbol: entry.symbol, // Given only when JOIN with table symbols
        tagIds: entry.tags,
        type: entry.type,
        usageIds: entry.usages,
      }
}

export function entryToOptionalStatement(entry) {
  return entry === null
    ? null
    : {
        ...entryToObject(entry),
        argumentCount: parseInt(entry.argument_count || "0"),
        rating: parseFloat(entry.rating || "0"),
        ratingCount: parseInt(entry.rating_count || "0"),
        ratingSum: parseInt(entry.rating_sum || "0"),
        trashed: entry.trashed || false,
      }
}

export function entryToStatement(entry) {
  return entry === null
    ? null
    : {
        ...entryToObject(entry),
        argumentCount: parseInt(entry.argument_count),
        rating: parseFloat(entry.rating),
        ratingCount: parseInt(entry.rating_count),
        ratingSum: parseInt(entry.rating_sum),
        trashed: entry.trashed,
      }
}

export function entryToUser(entry) {
  return entry === null
    ? null
    : {
        ...entryToObject(entry),
        activated: entry.activated,
        apiKey: entry.api_key,
        email: entry.email,
        isAdmin: entry.is_admin,
        name: entry.name,
        passwordDigest: entry.password_digest,
        salt: entry.salt,
        urlName: entry.url_name,
      }
}

export function entryToValue(entry) {
  return entry === null
    ? null
    : {
        ...entryToOptionalStatement(entry),
        schemaId: entry.schema_id,
        value: entry.value,
        widgetId: entry.widget_id,
      }
}

export async function generateObjectTextSearch(object) {
  if (object === null) return
  let autocompleteByLanguage = {}
  let englishId = getIdFromSymbol("en")
  let objectsCache = { [object.id]: object }
  let preferredLanguageFound
  let searchableTextsByWeightByLanguage = {}
  let table = null
  let weight
  if (object.type === "Card") {
    table = "cards"
    let valueIdByKeyId = object.properties
    if (valueIdByKeyId) {
      for (let language of configLanguages) {
        let autocomplete = null
        let languageId = getIdFromSymbol(language)
        let preferredLanguageIds = languageId === englishId ? [languageId, null] : [languageId, englishId, null]

        for (let preferredLanguageId of preferredLanguageIds) {
          for (let keySymbol of ["name", "title", "twitter-name"]) {
            let valueIds = valueIdByKeyId[getIdFromSymbol(keySymbol)]
            if (valueIds === undefined) continue
            if (!Array.isArray(valueIds)) valueIds = [valueIds]
            for (let valueId of valueIds) {
              autocomplete = await getLanguageTextFromId(valueId, preferredLanguageId, { objectsCache })
              if (autocomplete !== null) break
            }
            if (autocomplete !== null) break
          }
          if (autocomplete !== null) break
        }
        autocompleteByLanguage[language] = autocomplete ? `${autocomplete} #${object.id}` : `#${object.id}`

        preferredLanguageFound = false
        for (let preferredLanguageId of preferredLanguageIds) {
          for (let [keySymbol, weight] of [
            ["description", "B"],
            ["name", "A"],
            ["title", "A"],
            ["twitter-name", "A"],
          ]) {
            let valueIds = valueIdByKeyId[getIdFromSymbol(keySymbol)]
            if (valueIds === undefined) continue
            if (!Array.isArray(valueIds)) valueIds = [valueIds]
            for (let valueId of valueIds) {
              let text = await getLanguageTextFromId(valueId, preferredLanguageId, { objectsCache })
              if (text === null) continue
              let searchableTextsByWeight = searchableTextsByWeightByLanguage[language]
              if (searchableTextsByWeight === undefined) {
                searchableTextsByWeightByLanguage[language] = searchableTextsByWeight = {}
              }
              let searchableTexts = searchableTextsByWeight[weight]
              if (searchableTexts === undefined) searchableTextsByWeight[weight] = searchableTexts = []
              searchableTexts.push(text)
              preferredLanguageFound = true
            }
          }
          if (preferredLanguageFound) break
        }

        preferredLanguageFound = false
        weight = "B"
        for (let preferredLanguageId of preferredLanguageIds) {
          for (let valueId of object.tagIds || []) {
            let text = await getLanguageTextFromId(valueId, preferredLanguageId, { objectsCache })
            if (text === null) continue
            let searchableTextsByWeight = searchableTextsByWeightByLanguage[language]
            if (searchableTextsByWeight === undefined) {
              searchableTextsByWeightByLanguage[language] = searchableTextsByWeight = {}
            }
            let searchableTexts = searchableTextsByWeight[weight]
            if (searchableTexts === undefined) searchableTextsByWeight[weight] = searchableTexts = []
            searchableTexts.push(text)
            preferredLanguageFound = true
          }
          if (preferredLanguageFound) break
        }

        preferredLanguageFound = false
        weight = "C"
        for (let preferredLanguageId of preferredLanguageIds) {
          for (let valueId of object.usageIds || []) {
            let text = await getLanguageTextFromId(valueId, preferredLanguageId, { objectsCache })
            if (text === null) continue
            let searchableTextsByWeight = searchableTextsByWeightByLanguage[language]
            if (searchableTextsByWeight === undefined) {
              searchableTextsByWeightByLanguage[language] = searchableTextsByWeight = {}
            }
            let searchableTexts = searchableTextsByWeight[weight]
            if (searchableTexts === undefined) searchableTextsByWeight[weight] = searchableTexts = []
            searchableTexts.push(text)
            preferredLanguageFound = true
          }
          if (preferredLanguageFound) break
        }
      }
    }
  } else if (object.type === "User") {
    table = "users"
    // languages = [object.language]
    // for (let language of languages) {
    //   autocompleteByLanguage[language] = `${object.name} <${object.email}>`
    // }
    for (let language of configLanguages) {
      for (let text of [object.name, object.email]) {
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
  } else if (object.type === "Value") {
    table = "values"
    for (let language of configLanguages) {
      let languageId = getIdFromSymbol(language)
      let preferredLanguageIds = languageId === englishId ? [languageId, null] : [languageId, englishId, null]
      for (let preferredLanguageId of preferredLanguageIds) {
        let text = await getLanguageText(object, preferredLanguageId, { objectsCache })
        if (text === null) continue
        autocompleteByLanguage[language] = text
        searchableTextsByWeightByLanguage[language] = { A: [text] }
        break
      }
    }
  }

  if (table) {
    if (Object.keys(autocompleteByLanguage).length === 0) {
      await db.none(`DELETE FROM ${table}_autocomplete WHERE id = $1`, object.id)
    } else {
      let languagesByAutocomplete = {}
      for (let [language, autocomplete] of Object.entries(autocompleteByLanguage)) {
        let autocompleteLanguages = languagesByAutocomplete[autocomplete]
        if (autocompleteLanguages === undefined) {
          languagesByAutocomplete[autocomplete] = autocompleteLanguages = new Set()
        }
        autocompleteLanguages.add(language)
      }
      let usedLanguagesSetId = []
      for (let [autocomplete, autocompleteLanguages] of Object.entries(languagesByAutocomplete)) {
        let languagesSetId = await getOrNewLanguagesSetId(autocompleteLanguages)
        usedLanguagesSetId.push(languagesSetId)
        await db.none(
          `INSERT INTO ${table}_autocomplete(id, languages_set_id, autocomplete)
            VALUES ($1, $2, $3)
            ON CONFLICT (id, languages_set_id)
            DO UPDATE SET autocomplete = $3
          `,
          [object.id, languagesSetId, autocomplete],
        )
      }
      await db.none(`DELETE FROM ${table}_autocomplete WHERE id = $1 AND languages_set_id NOT IN ($2:csv)`, [
        object.id,
        usedLanguagesSetId,
      ])
    }

    if (Object.keys(searchableTextsByWeightByLanguage).length === 0) {
      await db.none(`DELETE FROM ${table}_text_search WHERE id = $1`, object.id)
    } else {
      let languagesByVector = {}
      for (let [language, searchableTextsByWeight] of Object.entries(searchableTextsByWeightByLanguage)) {
        let languageConfigurationName = languageConfigurationNameByCode[language]
        assert.ok(languageConfigurationName, language)
        let searchableTextByWeight = {
          A: (searchableTextsByWeight["A"] || []).join(" "),
          B: (searchableTextsByWeight["B"] || []).join(" "),
        }
        let {
          vector,
        } = await db.one(
          "SELECT setweight(to_tsvector($1, $2), 'A') || setweight(to_tsvector($1, $3), 'B') AS vector",
          [languageConfigurationName, searchableTextByWeight["A"], searchableTextByWeight["B"]],
        )
        assert.strictEqual(typeof vector, "string")
        let vectorLanguages = languagesByVector[vector]
        if (vectorLanguages === undefined) {
          languagesByVector[vector] = vectorLanguages = new Set()
        }
        vectorLanguages.add(language)
      }
      let usedLanguagesSetId = []
      for (let [vector, vectorLanguages] of Object.entries(languagesByVector)) {
        let languagesSetId = await getOrNewLanguagesSetId(vectorLanguages)
        usedLanguagesSetId.push(languagesSetId)
        await db.none(
          `INSERT INTO ${table}_text_search(id, languages_set_id, text_search)
            VALUES ($1, $2, $3)
            ON CONFLICT (id, languages_set_id)
            DO UPDATE SET text_search = $3
          `,
          [object.id, languagesSetId, vector],
        )
      }
      await db.none(`DELETE FROM ${table}_text_search WHERE id = $1 AND languages_set_id NOT IN ($2:csv)`, [
        object.id,
        usedLanguagesSetId,
      ])
    }
  }
}

async function getLanguageText(
  typedValue,
  languageId,
  { objectsCache = null, visitedIds = null } = null,
) {
  if (typedValue === null) {
    return null
  }
  const stringSchemaIds = new Set([
    getIdFromSymbol("schema:email"),
    getIdFromSymbol("schema:string"),
    getIdFromSymbol("schema:uri"),
  ])
  if (languageId === null) {
    return stringSchemaIds.has(typedValue.schemaId) ? typedValue.value : String(typedValue.value)
  }
  if (!stringSchemaIds.has(typedValue.schemaId)) {
    return null
  }
  let properties = typedValue.properties
  if (!properties) {
    return null
  }
  let textIds = properties[languageId]
  if (textIds !== undefined) {
    // Some values for the requested language have bien found, return the best value (aka the first one).
    let textId = Array.isArray(textIds) ? textIds[0] : textIds
    if (textId === typedValue.id) {
      return typedValue.value
    }
    return await getLanguageTextFromId(textId, null, { objectsCache, visitedIds })
  }

  // There is no direct localization for the requested language.
  // Ask to the other localizations (because they can themselves be localized to the requested language).
  if (visitedIds === null) {
    visitedIds = new Set([])
  } else if (visitedIds.has(typedValue.id)) {
    return null
  }
  visitedIds.add(typedValue.id)
  for (let [otherLanguageId, textIds] of Object.entries(properties)) {
    if (!configLanguageIds.has(otherLanguageId)) {
      // This is not the ID of a language => Skip it.
      continue
    }
    if (!Array.isArray(textIds)) textIds = [textIds]
    for (let textId of textIds) {
      let text = await getLanguageTextFromId(textId, languageId, { objectsCache, visitedIds })
      if (text !== null) {
        return text
      }
    }
  }

  // There is no localization for the requested language.
  return null
}

async function getLanguageTextFromId(
  valueId,
  languageId,
  { objectsCache = null, visitedIds = null } = null,
) {
  let typedValue
  if (objectsCache === null) {
    typedValue = await getObjectFromId(valueId)
  } else {
    typedValue = objectsCache[valueId]
    if (typedValue === undefined) {
      objectsCache[valueId] = typedValue = await getObjectFromId(valueId)
    }
  }
  return await getLanguageText(typedValue, languageId, { objectsCache, visitedIds })
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
    return entryToCard({ ...entry, ...cardEntry })
  } else if (entry.type === "Property") {
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
    return entryToProperty({ ...entry, ...propertyEntry })
  } else if (entry.type === "User") {
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
    return entryToUser({ ...entry, ...userEntry })
  } else if (entry.type === "Value") {
    let valueEntry = await db.oneOrNone(
      `
        SELECT values.*, argument_count, rating, rating_count, rating_sum, symbol, trashed
        FROM values
        LEFT JOIN statements ON values.id = statements.id
        LEFT JOIN symbols ON values.id = symbols.id
        WHERE values.id = $<id>
      `,
      entry,
    )
    if (valueEntry === null) {
      console.log(`Missing values row for object of type Value at ID ${entry.id}`)
      return null
    }
    return entryToValue({ ...entry, ...valueEntry })
  } else {
    throw `Unknown object type "${entry.type}" at ID ${id}`
  }
}

export async function getOrNewLanguagesSetId(languages) {
  assert.ok(languages instanceof Set, languages)
  languages = [...languages].sort()
  const languagesString = languages.join(",")
  let id = languagesSetIdByLanguages[languagesString]
  if (id === undefined) {
    let result = await db.oneOrNone(
      `
        SELECT id from languages_sets
        WHERE languages = $<languages>
      `,
      {
        languages,
      },
    )
    if (result === null) {
      result = await db.one(
        `
          INSERT INTO languages_sets(languages)
          VALUES ($<languages>)
          RETURNING id
        `,
        {
          languages,
        },
      )
    }
    id = result.id
    languagesSetIdByLanguages[languagesString] = id
  }
  return id
}

export async function getOrNewLocalizedString(
  language,
  string,
  widgetIdOrSymbol,
  { cache = null, inactiveStatementIds = null, properties = null, userId = null } = {},
) {
  assert.strictEqual(typeof string, "string")
  let widgetId = getIdFromIdOrSymbol(widgetIdOrSymbol)
  let typedString = await getOrNewValue(getIdFromSymbol("schema:string"), widgetId, string, {
    cache,
    inactiveStatementIds,
    properties,
    userId,
  })
  if (userId) {
    // Set string as its own localization in given language.
    let languageId = getIdFromSymbol(language)
    await getOrNewProperty(typedString.id, languageId, typedString.id, 1, {
      inactiveStatementIds,
      userId,
    })
    // Do optimistic optimization.
    properties = typedString.properties
    let propertiesChanged = false
    if (properties === null) {
      typedString.properties = properties = {}
    }
    let valueIds = properties[languageId]
    if (valueIds === undefined) {
      properties[languageId] = typedString.id
      propertiesChanged = true
    } else if (Array.isArray(valueIds)) {
      if (!valueIds.includes(typedString.id)) {
        properties[languageId] = [...valueIds, typedString.id]
        propertiesChanged = true
      }
    } else if (valueIds !== typedString.id) {
      properties[languageId] = [valueIds, typedString.id]
      propertiesChanged = true
    }
    if (propertiesChanged) {
      await db.none(
        `
          UPDATE objects
          SET properties = $<properties:json>
          WHERE id = $<id>
        `,
        typedString,
      )
    }
  }
  return typedString
}

export async function getOrNewProperty(
  objectId,
  keyId,
  valueId,
  rating, // One of undefined, null, -1, 0, 1
  { inactiveStatementIds = null, properties = null, userId = null } = {},
) {
  assert.strictEqual(typeof objectId, "string")
  assert.strictEqual(typeof keyId, "string")
  assert.strictEqual(typeof valueId, "string")
  if (properties) assert(userId, "Properties can only be set when userId is not null.")

  // TODO: Remove ? Split arrays into atomic properties.
  let typedValue = await getObjectFromId(valueId)
  if (typedValue.schemaId === getIdFromSymbol("schema:ids-array")) {
    assert(properties === null)
    let splitProperties = []
    for (let itemId of typedValue.value) {
      splitProperties.push(
        await getOrNewProperty(objectId, keyId, itemId, rating, { inactiveStatementIds, properties, userId }),
      )
    }
    return splitProperties
  }

  let property = entryToProperty(
    await db.oneOrNone(
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
    ),
  )
  if (property === null) {
    let result = await db.one(
      `
        INSERT INTO objects(created_at, properties, type)
        VALUES (current_timestamp, $<properties:json>, 'Property')
        RETURNING created_at, id, properties, sub_types, tags, type, usages
      `,
      {
        properties, // Note: Properties are typically set for optimistic optimization.
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
        RETURNING argument_count, rating, rating_count, rating_sum, trashed
      `,
      property,
    )
    property = {
      ...property,
      argumentCount: result.argument_count,
      rating: result.rating,
      ratingCount: result.rating_count,
      ratingSum: result.rating_sum,
      trashed: result.trashed,
    }
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
    if ([-1, 0, 1].includes(rating)) await rateStatement(property, userId, rating)
    if (inactiveStatementIds) inactiveStatementIds.delete(property.id)
  }
  if (properties) {
    for (let [keyId, valueId] of Object.entries(properties)) {
      assert.strictEqual(typeof keyId, "string")
      assert.strictEqual(typeof valueId, "string")
      await getOrNewProperty(property.id, keyId, valueId, 1, {
        inactiveStatementIds,
        userId,
      })
    }
  }
  return property
}

export async function getOrNewValue(
  schemaId,
  widgetId,
  value,
  { cache = null, inactiveStatementIds = null, properties = null, userId = null } = {},
) {
  assert(typeof schemaId === "string")
  if (properties) assert(userId, "Properties can only be set when userId is not null.")

  let cacheKey
  if (cache !== null) {
    cacheKey = JSON.stringify({ schemaId, type: "Value", value, widgetId })
    let cacheValue = cache[cacheKey]
    if (cacheValue !== undefined) return cacheValue
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
        properties, // Note: Properties are typically set for optimistic optimization.
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
    for (let [keyId, valueId] of Object.entries(properties)) {
      assert.strictEqual(typeof keyId, "string")
      assert.strictEqual(typeof valueId, "string")
      await getOrNewProperty(typedValue.id, keyId, valueId, 1, {
        inactiveStatementIds,
        userId,
      })
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
    subTypeIds = properties[getIdFromSymbol("type")]
    if (subTypeIds === undefined) {
      subTypeIds = null
    } else {
      if (!Array.isArray(subTypeIds)) {
        // subTypeIds is a single ID.
        subTypeIds = [subTypeIds]
      }
      let validSubTypeIds = new Set()
      for (let subTypeId of subTypeIds) {
        let subTypeTypedValue = await getObjectFromId(subTypeId)
        if (subTypeTypedValue.schemaId === getIdFromSymbol("schema:string")) {
          validSubTypeIds.add(subTypeId)
        } else if (subTypeTypedValue.schemaId === getIdFromSymbol("schema:ids-array")) {
          for (let itemId of subTypeTypedValue.value) {
            let typedItem = await getObjectFromId(itemId)
            if (typedItem.schemaId === getIdFromSymbol("schema:string")) {
              validSubTypeIds.add(itemId)
            }
          }
        }
      }
      subTypeIds = [...validSubTypeIds].sort()
      if (subTypeIds.length === 0) subTypeIds = null
    }
  }
  return subTypeIds
}

export async function getTagIdsFromProperties(properties) {
  let tagIds = null
  if (properties) {
    tagIds = properties[getIdFromSymbol("tags")]
    if (tagIds === undefined) {
      tagIds = null
    } else {
      if (!Array.isArray(tagIds)) {
        // tagIds is a single ID.
        tagIds = [tagIds]
      }
      let validTagIds = new Set()
      for (let tagId of tagIds) {
        let tagTypedValue = await getObjectFromId(tagId)
        if (tagTypedValue.schemaId === getIdFromSymbol("schema:string")) {
          validTagIds.add(tagId)
        } else if (tagTypedValue.schemaId === getIdFromSymbol("schema:ids-array")) {
          for (let itemId of tagTypedValue.value) {
            let typedItem = await getObjectFromId(itemId)
            if (typedItem.schemaId === getIdFromSymbol("schema:string")) {
              validTagIds.add(itemId)
            }
          }
        }
      }
      tagIds = [...validTagIds].sort()
      if (tagIds.length === 0) tagIds = null
    }
  }
  return tagIds
}

export async function getValue(schemaId, widgetId, value) {
  // Note: The ORDER BY objects.id LIMIT 1 is a tentative to reduce the number of used duplicate values.
  return entryToValue(
    await db.oneOrNone(
      `
        SELECT objects.*, values.*, argument_count, rating, rating_count, rating_sum, symbol, trashed
        FROM objects
        INNER JOIN values ON objects.id = values.id
        LEFT JOIN statements ON values.id = statements.id
        LEFT JOIN symbols ON values.id = symbols.id
        WHERE schema_id = $<schemaId>
        AND value = $<value:json>
        ORDER BY objects.id
        LIMIT 1
      `,
      {
        schemaId,
        value,
      },
    ),
  )
}

export async function newCard({ inactiveStatementIds = null, properties = null, userId = null } = {}) {
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
      properties, // Note: Properties are typically set for optimistic optimization.
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
      RETURNING argument_count, rating, rating_count, rating_sum, trashed
    `,
    card,
  )
  card = {
    ...card,
    argumentCount: result.argument_count,
    rating: result.rating,
    ratingCount: result.rating_count,
    ratingSum: result.rating_sum,
    trashed: result.trashed,
  }
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
    for (let [keyId, valueId] of Object.entries(properties)) {
      assert.strictEqual(typeof keyId, "string")
      assert.strictEqual(typeof valueId, "string")
      await getOrNewProperty(card.id, keyId, valueId, 1, { inactiveStatementIds, userId })
    }
  }

  return card
}

export function ownsUser(user, otherUser) {
  if (!user) return false
  if (user.isAdmin) return true
  return user.id === otherUser.id
}

export function ownsUserId(user, otherUserId) {
  if (!user) return false
  if (user.isAdmin) return true
  return user.id === otherUserId
}

export async function rateStatement(statement, voterId, rating) {
  assert.ok(statement)
  assert.notStrictEqual(typeof statement, "string")
  if (statement.type === "Value" && statement.ratingSum === 0) {
    await db.none(
      `
        INSERT INTO statements(id)
        VALUES ($<id>)
        ON CONFLICT (id) DO NOTHING
      `,
      statement,
    )
  }
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
  let oldBallot = entryToBallot(
    await db.oneOrNone("SELECT * FROM ballots WHERE statement_id = $<statementId> AND voter_id = $<voterId>", ballot),
  )
  if (oldBallot === null) {
    let result = await db.one(
      `INSERT INTO ballots(rating, statement_id, updated_at, voter_id)
        VALUES ($<rating>, $<statementId>, current_timestamp, $<voterId>)
        RETURNING updated_at`,
      ballot,
    )
    ballot.updatedAt = result.updated_at
    await addAction(statementId, "update")
  } else if (rating !== oldBallot.rating) {
    let result = await db.one(
      `UPDATE ballots
        SET rating = $<rating>, updated_at = current_timestamp
        WHERE statement_id = $<statementId> AND voter_id = $<voterId>
        RETURNING updated_at`,
      ballot,
    )
    ballot.updatedAt = result.updated_at
    await addAction(statementId, "update")
  } else {
    ballot = oldBallot
  }
  return [oldBallot, ballot]
}

export { toBallotData }
async function toBallotData(
  ballot,
  statementOrStatements,
  user,
  {
    depth = 0,
    objectsCache = null,
    showBallots = false,
    showReferences = false,
    showValues = false,
  } = {},
) {
  objectsCache = objectsCache || {}
  let data = {
    ballots: { [ballot.id]: toBallotJson(ballot) },
    cards: {},
    id: ballot.id,
    properties: {},
    users: {},
    values: {},
    visitedIds: new Set(),
  }

  if (statementOrStatements !== null) {
    if (Array.isArray(statementOrStatements)) {
      for (let object of statementOrStatements) {
        await toDataJson1(object, data, objectsCache, user, {
          depth,
          showBallots,
          showReferences,
          showValues,
        })
      }
    } else {
      assert.ok(statementOrStatements)
      await toDataJson1(statementOrStatements, data, objectsCache, user, {
        depth,
        showBallots,
        showReferences,
        showValues,
      })
    }
  }

  if (Object.keys(data.ballots).length === 0) delete data.ballots
  if (Object.keys(data.cards).length === 0) delete data.cards
  if (Object.keys(data.properties).length === 0) delete data.properties
  if (Object.keys(data.users).length === 0) delete data.users
  if (Object.keys(data.values).length === 0) delete data.values
  delete data.visitedIds
  return data
}

function toBallotJson(ballot) {
  let ballotJson = { ...ballot }
  if (ballotJson.updatedAt) ballotJson.updatedAt = ballotJson.updatedAt.toISOString()
  return ballotJson
}

export async function toDataJson(
  objectOrObjects,
  user,
  {
    depth = 0,
    objectsCache = null,
    showBallots = false,
    showReferences = false,
    showValues = false,
  } = {},
) {
  objectsCache = objectsCache || {}
  let data = {
    ballots: {},
    cards: {},
    properties: {},
    users: {},
    values: {},
    visitedIds: new Set(),
  }

  if (objectOrObjects !== null) {
    if (Array.isArray(objectOrObjects)) {
      data.ids = objectOrObjects.map(object => object.symbol || object.id)
      for (let object of objectOrObjects) {
        await toDataJson1(object, data, objectsCache, user, {
          depth,
          showBallots,
          showReferences,
          showValues,
        })
      }
    } else {
      assert.ok(objectOrObjects)
      data.id = objectOrObjects.symbol || objectOrObjects.id
      await toDataJson1(objectOrObjects, data, objectsCache, user, {
        depth,
        showBallots,
        showReferences,
        showValues,
      })
    }
  }

  if (Object.keys(data.ballots).length === 0) delete data.ballots
  if (Object.keys(data.cards).length === 0) delete data.cards
  if (Object.keys(data.properties).length === 0) delete data.properties
  if (Object.keys(data.users).length === 0) delete data.users
  if (Object.keys(data.values).length === 0) delete data.values
  delete data.visitedIds
  return data
}

export async function toDataJson1(
  idOrObject,
  data,
  objectsCache,
  user,
  { depth = 0, showBallots = false, showReferences = false, showValues = false } = {},
) {
  let object
  if (typeof idOrObject === "number") idOrObject = String(idOrObject)
  if (typeof idOrObject === "string") {
    if (data.visitedIds.has(idOrObject)) return
    object = objectsCache[idOrObject]
    if (object === undefined) {
      object = await getObjectFromId(idOrObject)
      objectsCache[object.id] = object
    }
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

    const cachedObject = objectsCache[object.id]
    if (cachedObject) object = cachedObject
  }
  data.visitedIds.add(object.id)

  const objectJsonByIdOrSymbol = {
    Card: data.cards,
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
      let ballot = entryToBallot(
        await db.oneOrNone("SELECT * FROM ballots WHERE statement_id = $1 AND voter_id = $2", [object.id, user.id]),
      )
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
      await toDataJson1(referencedId, data, objectsCache, user, {
        depth: depth - 1,
        showBallots,
        showReferences,
        showValues,
      })
    }

    let references = {}
    for (let { id, sub_types } of sourceEntries.concat(targetEntries)) {
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
      await toDataJson1(object.keyId, data, objectsCache, user, {
        depth: depth - 1,
        showBallots,
        showValues,
      })
      await toDataJson1(object.objectId, data, objectsCache, user, {
        depth: depth - 1,
        showBallots,
        showValues,
      })
      await toDataJson1(object.valueId, data, objectsCache, user, {
        depth: depth - 1,
        showBallots,
        showValues,
      })
    } else if (object.type == "Value") {
      if (object.schemaId === getIdFromSymbol("schema:ids-array")) {
        for (let itemId of object.value) {
          await toDataJson1(itemId, data, objectsCache, user, {
            depth: depth - 1,
            showBallots,
            showValues,
          })
        }
      }
    }

    for (let [keyId, valueIds] of Object.entries(object.properties || {})) {
      await toDataJson1(keyId, data, objectsCache, user, {
        depth: depth - 1,
        showBallots,
        showValues,
      })
      if (!Array.isArray(valueIds)) valueIds = [valueIds]
      for (let valueId of valueIds) {
        await toDataJson1(valueId, data, objectsCache, user, {
          depth: depth - 1,
          showBallots,
          showValues,
        })
      }
    }

    for (let subTypeId of object.subTypeIds || []) {
      await toDataJson1(subTypeId, data, objectsCache, user, {
        depth: depth - 1,
        showBallots,
        showValues,
      })
    }

    for (let tagId of object.tagIds || []) {
      await toDataJson1(tagId, data, objectsCache, user, {
        depth: depth - 1,
        showBallots,
        showValues,
      })
    }

    for (let usageId of object.usageIds || []) {
      await toDataJson1(usageId, data, objectsCache, user, {
        depth: depth - 1,
        showBallots,
        showValues,
      })
    }
  }
}

export async function toSchemaValueJson(schema, value) {
  if (schema.$ref === "/schemas/id") {
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

export async function toObjectJson(object, { showApiKey = false, showEmail = false } = {}) {
  let objectJson = { ...object }
  objectJson.createdAt = objectJson.createdAt.toISOString()
  if (objectJson.properties) {
    let properties = (objectJson.properties = { ...objectJson.properties })
    for (let [keyId, valueIds] of Object.entries(properties)) {
      let keySymbol = getIdOrSymbolFromId(keyId)
      if (!Array.isArray(valueIds)) valueIds = [valueIds]
      properties[keySymbol] = valueIds.map(getIdOrSymbolFromId)
      if (keySymbol !== keyId) delete properties[keyId]
    }
  }
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
    } else {
      delete objectJson.tagIds
    }
  }

  if (object.type === "Property") {
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

export { toUserJson }
function toUserJson(user, { showApiKey = false, showEmail = false } = {}) {
  let userJson = { ...user }
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
  }
  return oldBallot
}

export async function unrateStatementId(statementId, voterId) {
  assert.strictEqual(typeof statementId, "string")
  let ballot = {
    statementId,
    voterId,
  }
  let oldBallot = entryToBallot(
    await db.oneOrNone("SELECT * FROM ballots WHERE statement_id = $<statementId> AND voter_id = $<voterId>", ballot),
  )
  if (oldBallot !== null) {
    await db.none("DELETE FROM ballots WHERE statement_id = $<statementId> AND voter_id = $<voterId>", ballot)
    await addAction(statementId, "update")
  }
  return oldBallot
}

export const wrapAsyncMiddleware = fn => (...args) => fn(...args).catch(args[2])
