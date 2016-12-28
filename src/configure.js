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

import {db, versionNumber} from "./database"
import {entryToValue, getOrNewProperty, getValue, types} from "./model"
import {getIdFromSymbol, symbolizedTypedValues, idBySymbol, symbolById} from "./symbols"


async function configureDatabase() {
  // Check that database exists.
  await db.connect()

  // Table: version
  await db.none(`
    CREATE TABLE IF NOT EXISTS version(
      number integer NOT NULL,
      text integer NOT NULL
    )
  `)
  let version = await db.oneOrNone("SELECT * FROM version")
  if (version === null) {
    await db.none("INSERT INTO version(number, text) VALUES ($<number>, $<text>)", {
      number: versionNumber,
      text: 0,
    })
    version = await db.one("SELECT * FROM version")
  }
  assert(version.number <= versionNumber,
    `Database is too recent for current version of application: ${version.number} > ${versionNumber}.`)
  if (version.number < versionNumber) {
    console.log(`Upgrading database from version ${version.number} to ${versionNumber}...`)
  }

  if (version.number < 1) {
    // Remove non UNIQUE index to recreate it.
    await db.none("DROP INDEX IF EXISTS statements_hash_idx")
  }
  if (version.number < 5) {
    // Add support for trigrams.
    // TODO: Database user must be database owner.
    // await db.none("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    console.log(`
      YOU MUST manually execute the following SQL commands:
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `)
  }
  if (version.number < 7) {
    await db.none("ALTER TABLE version ADD COLUMN IF NOT EXISTS text integer")
    await db.none("UPDATE version SET text = $1", 0)
    await db.none("ALTER TABLE version ALTER COLUMN text SET NOT NULL")
  }
  if (version.number < 9) {
    console.log(`
      Database schema has changed and is not upgradable.
      YOU MUST manually execute the following SQL commands:
        DROP TABLE actions, ballots, statements, statements_autocomplete, statements_text_search, users CASCADE;
        DROP TYPE event_type, statement_type;
    `)
  }
  if (version.number < 10) {
    await db.none("DROP TABLE IF EXISTS values_symbols")
  }
  if (version.number < 11) {
    await db.none("ALTER TABLE objects ADD COLUMN IF NOT EXISTS sub_types text[]")
  }
  if (version.number < 12) {
    await db.none("ALTER TABLE objects ADD COLUMN IF NOT EXISTS tags jsonb")
  }
  if (version.number < 13) {
    await db.none("ALTER TABLE users ADD COLUMN IF NOT EXISTS activated boolean DEFAULT FALSE")
  }
  if (version.number < 14) {
    await db.none("DROP INDEX IF EXISTS users_api_key_idx")
    await db.none("DROP INDEX IF EXISTS users_email_idx")
    await db.none("DROP INDEX IF EXISTS users_url_name_idx")
  }
  if (version.number < 17) {
    await db.none("ALTER TABLE objects DROP COLUMN IF EXISTS tags")
    await db.none("ALTER TABLE objects ADD COLUMN IF NOT EXISTS tags text[]")
    await db.none("ALTER TABLE objects ADD COLUMN IF NOT EXISTS usages text[]")
  }
  if (version.number < 18) {
    await db.none("DROP INDEX IF EXISTS values_schema_id_widget_id_value_idx")
    await db.none("DROP TABLE IF EXISTS cards_autocomplete")
    await db.none("DROP TABLE IF EXISTS concepts_autocomplete")
    await db.none("DROP TABLE IF EXISTS users_autocomplete")
    await db.none("DROP TABLE IF EXISTS values_autocomplete")
  }

  // Objects

  // Table: objects
  // An object is something that may have properties.
  await db.none(
    `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'object_type') THEN
          CREATE TYPE object_type AS ENUM ($<types:csv>);
        END IF;
      END$$
    `,
    {
      types,
    },
  )
  await db.none(`
    CREATE TABLE IF NOT EXISTS objects(
      created_at timestamp without time zone NOT NULL,
      id bigserial NOT NULL PRIMARY KEY,
      properties jsonb,
      sub_types text[],
      tags text[],
      type object_type NOT NULL,
      usages text[]
    )
  `)
  await db.none("CREATE INDEX IF NOT EXISTS objects_created_at_idx ON objects(created_at)")
  await db.none(`
    CREATE INDEX IF NOT EXISTS objects_sub_types_idx
    ON objects
    USING GIN (sub_types)
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS objects_tags_idx
    ON objects
    USING GIN (tags)
  `)

  // Table: objects_references
  await db.none(`
    CREATE TABLE IF NOT EXISTS objects_references(
      source_id bigint NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      target_id bigint NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      PRIMARY KEY (source_id, target_id)
    )
  `)
  await db.none("CREATE INDEX IF NOT EXISTS references_source_id_idx ON objects_references(source_id)")
  await db.none("CREATE INDEX IF NOT EXISTS references_target_id_idx ON objects_references(target_id)")

  // Table: users
  await db.none(`
    CREATE TABLE IF NOT EXISTS users(
      activated boolean NOT NULL DEFAULT FALSE,
      api_key text UNIQUE NOT NULL,
      email text UNIQUE NOT NULL,
      id bigint NOT NULL PRIMARY KEY REFERENCES objects(id) ON DELETE CASCADE,
      is_admin boolean NOT NULL DEFAULT FALSE,
      name text NOT NULL,
      password_digest text NOT NULL,
      salt text NOT NULL,
      url_name text UNIQUE NOT NULL
    )
  `)
  await db.none("CREATE UNIQUE INDEX IF NOT EXISTS users_api_key_idx ON users(api_key)")
  await db.none("CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email)")
  await db.none("CREATE UNIQUE INDEX IF NOT EXISTS users_url_name_idx ON users(url_name)")

  // Table: users_autocomplete
  await db.none(`
    CREATE TABLE IF NOT EXISTS users_autocomplete(
      autocomplete text NOT NULL,
      configuration_name text NOT NULL,
      id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (id, configuration_name)
    )
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS users_autocomplete_trigrams_idx
      ON users_autocomplete
      USING GIST (autocomplete gist_trgm_ops)
  `)

  // Table: users_text_search
  await db.none(`
    CREATE TABLE IF NOT EXISTS users_text_search(
      configuration_name text NOT NULL,
      id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text_search tsvector,
      PRIMARY KEY (id, configuration_name)
    )
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS users_text_search_idx
      ON users_text_search
      USING GIN (text_search)
  `)

  // Table: values
  await db.none(`
    CREATE TABLE IF NOT EXISTS values(
      id bigint NOT NULL PRIMARY KEY REFERENCES objects(id) ON DELETE CASCADE,
      schema_id bigint NOT NULL REFERENCES values(id) ON DELETE RESTRICT,
      value jsonb NOT NULL,
      widget_id bigint REFERENCES values(id) ON DELETE RESTRICT
    )
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS values_schema_id_value_idx
    ON values(schema_id, value)
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS values_value_idx
    ON values USING GIN (value jsonb_path_ops)
  `)

  // Table: values_autocomplete
  await db.none(`
    CREATE TABLE IF NOT EXISTS values_autocomplete(
      autocomplete text NOT NULL,
      configuration_name text NOT NULL,
      id bigint NOT NULL REFERENCES values(id) ON DELETE CASCADE,
      PRIMARY KEY (id, configuration_name)
    )
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS values_autocomplete_trigrams_idx
      ON values_autocomplete
      USING GIST (autocomplete gist_trgm_ops)
  `)

  // Table: symbols
  await db.none(`
    CREATE TABLE IF NOT EXISTS symbols(
      id bigint NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      symbol text NOT NULL PRIMARY KEY
    )
  `)

  // Table: values_text_search
  await db.none(`
    CREATE TABLE IF NOT EXISTS values_text_search(
      configuration_name text NOT NULL,
      id bigint NOT NULL REFERENCES values(id) ON DELETE CASCADE,
      text_search tsvector,
      PRIMARY KEY (id, configuration_name)
    )
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS values_text_search_idx
      ON values_text_search
      USING GIN (text_search)
  `)

  // Rated Objects (aka statements)

  // Table: statements
  await db.none(`
    CREATE TABLE IF NOT EXISTS statements(
      id bigint NOT NULL PRIMARY KEY REFERENCES objects(id) ON DELETE CASCADE,
      rating double precision NOT NULL DEFAULT 0,
      rating_count integer NOT NULL DEFAULT 0,
      rating_sum integer NOT NULL DEFAULT 0
    )
  `)

  // Table: cards
  await db.none(`
    CREATE TABLE IF NOT EXISTS cards(
      id bigint NOT NULL PRIMARY KEY REFERENCES statements(id) ON DELETE CASCADE
    )
  `)

  // Table: cards_autocomplete
  await db.none(`
    CREATE TABLE IF NOT EXISTS cards_autocomplete(
      autocomplete text NOT NULL,
      configuration_name text NOT NULL,
      id bigint NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      PRIMARY KEY (id, configuration_name)
    )
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS cards_autocomplete_trigrams_idx
      ON cards_autocomplete
      USING GIST (autocomplete gist_trgm_ops)
  `)

  // Table: cards_text_search
  await db.none(`
    CREATE TABLE IF NOT EXISTS cards_text_search(
      configuration_name text NOT NULL,
      id bigint NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      text_search tsvector,
      PRIMARY KEY (id, configuration_name)
    )
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS cards_text_search_idx
      ON cards_text_search
      USING GIN (text_search)
  `)

  // Table: concepts
  await db.none(`
    CREATE TABLE IF NOT EXISTS concepts(
      id bigint NOT NULL PRIMARY KEY REFERENCES statements(id) ON DELETE CASCADE,
      value_id bigint NOT NULL REFERENCES values(id) ON DELETE RESTRICT
    )
  `)

  // Table: concepts_autocomplete
  await db.none(`
    CREATE TABLE IF NOT EXISTS concepts_autocomplete(
      autocomplete text NOT NULL,
      configuration_name text NOT NULL,
      id bigint NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      PRIMARY KEY (id, configuration_name)
    )
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS concepts_autocomplete_trigrams_idx
      ON concepts_autocomplete
      USING GIST (autocomplete gist_trgm_ops)
  `)

  // Table: concepts_text_search
  await db.none(`
    CREATE TABLE IF NOT EXISTS concepts_text_search(
      configuration_name text NOT NULL,
      id bigint NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      text_search tsvector,
      PRIMARY KEY (id, configuration_name)
    )
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS concepts_text_search_idx
      ON concepts_text_search
      USING GIN (text_search)
  `)

  // Table: properties
  await db.none(`
    CREATE TABLE IF NOT EXISTS properties(
      id bigint NOT NULL PRIMARY KEY REFERENCES statements(id) ON DELETE CASCADE,
      key_id bigint NOT NULL REFERENCES values(id) ON DELETE RESTRICT,
      object_id bigint NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      value_id bigint NOT NULL REFERENCES values(id) ON DELETE RESTRICT
    )
  `)
  await db.none("CREATE INDEX IF NOT EXISTS properties_object_id_key_id_idx ON properties(object_id, key_id)")

  // Table: actions
  await db.none(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
        CREATE TYPE event_type AS ENUM (
          'properties',
          'rating'
        );
      END IF;
    END$$
  `)
  await db.none(`
    CREATE TABLE IF NOT EXISTS actions(
      created_at timestamp without time zone NOT NULL,
      id bigserial NOT NULL PRIMARY KEY,
      object_id bigint NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      type event_type NOT NULL,
      UNIQUE (object_id, type)
    )
  `)
  await db.none("CREATE INDEX IF NOT EXISTS actions_created_at_idx ON actions(created_at)")
  await db.none("CREATE INDEX IF NOT EXISTS actions_type_object_id_idx ON actions(type, object_id)")
  await db.none(`
    CREATE OR REPLACE FUNCTION notify_new_action() RETURNS trigger AS $$
    BEGIN
      PERFORM pg_notify('new_action', '');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)
  try {
    await db.none("DROP TRIGGER action_inserted ON actions")
  } catch (e) {}
  await db.none(`
    CREATE TRIGGER action_inserted AFTER INSERT ON actions
    FOR EACH ROW
    EXECUTE PROCEDURE notify_new_action()
  `)

  // Table: ballots
  await db.none(`
    CREATE TABLE IF NOT EXISTS ballots(
      rating smallint CHECK (rating >= -1 AND rating <= 1),
      statement_id bigint NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
      updated_at timestamp without time zone NOT NULL,
      voter_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (statement_id, voter_id)
    )
  `)
  await db.none("CREATE INDEX IF NOT EXISTS ballots_statement_id_idx ON ballots(statement_id)")
  // await db.none("CREATE INDEX IF NOT EXISTS ballots_updated_at_idx ON ballots(updated_at)")
  await db.none("CREATE INDEX IF NOT EXISTS ballots_voter_id_idx ON ballots(voter_id)")

  // Table: collections
  await db.none(`
    CREATE TABLE IF NOT EXISTS collections(
      author bigint NOT NULL REFERENCES users(id),
      cards bigint[],
      created_at timestamp without time zone NOT NULL,
      description text,
      id bigserial NOT NULL PRIMARY KEY,
      logo text,
      name text NOT NULL
    )
  `)
  await db.none("CREATE INDEX IF NOT EXISTS collections_author_idx ON collections(author)")

  // Table: keys
  // Contains the prefered schemas and widgets for each key of properties
  await db.none(`
    CREATE TABLE IF NOT EXISTS keys(
      id bigint NOT NULL PRIMARY KEY REFERENCES values(id) ON DELETE CASCADE,
      schemas_widgets_order jsonb NOT NULL
    )
  `)

  // Table: types
  // Contains the prefered keys for each type (of card).
  await db.none(`
    CREATE TABLE IF NOT EXISTS types(
      id bigint NOT NULL PRIMARY KEY REFERENCES values(id) ON DELETE CASCADE,
      keys_order jsonb NOT NULL
    )
  `)

  const previousVersionNumber = version.number

  if (version.number < 2) {
    try {
      await db.none("DROP TRIGGER event_inserted ON events")
    } catch (e) {}
    await db.none("DROP TABLE IF EXISTS events")
  }
  if (version.number < 3) {
    // TODO: Database user must be owner of type statement_type.
    // await db.none("ALTER TYPE statement_type ADD VALUE IF NOT EXISTS 'Citation' AFTER 'Card'")
    // await db.none("ALTER TYPE statement_type ADD VALUE IF NOT EXISTS 'Event' AFTER 'Citation'")
    // await db.none("ALTER TYPE statement_type ADD VALUE IF NOT EXISTS 'Person' AFTER 'PlainStatement'")
    console.log(`
      YOU MUST manually execute the following SQL commands:
        ALTER TYPE statement_type ADD VALUE IF NOT EXISTS 'Citation' AFTER 'Card';
        ALTER TYPE statement_type ADD VALUE IF NOT EXISTS 'Event' AFTER 'Citation';
        ALTER TYPE statement_type ADD VALUE IF NOT EXISTS 'Person' AFTER 'Event';
    `)
  }
  if (version.number < 8) {
    console.log(`
      YOU MUST manually execute the following SQL commands:
        DROP TABLE actions, ballots, statements, statements_autocomplete, statements_text_search;
        DROP TYPE statement_type;
    `)
  }
  if (version.number < 13) {
    await db.none("UPDATE users SET activated = FALSE WHERE activated IS NULL")
    await db.none("ALTER TABLE users ALTER COLUMN activated SET NOT NULL")
  }
  if (version.number < 14) {
    await db.none("ALTER TABLE users ADD UNIQUE USING INDEX users_api_key_idx")
    await db.none("ALTER TABLE users ADD UNIQUE USING INDEX users_email_idx")
    await db.none("ALTER TABLE users ADD UNIQUE USING INDEX users_url_name_idx")
  }

  await configureSymbols()

  version.number = versionNumber
  assert(version.number >= previousVersionNumber,
    `Error in database upgrade script: Wrong version number: ${version.number} < ${previousVersionNumber}.`)
  if (version.number !== previousVersionNumber) {
    await db.none("UPDATE version SET number = $1", version.number)
    console.log(`Upgraded database from version ${previousVersionNumber} to ${version.number}.`)
  }
}


async function configureSymbols() {
  // Create missing symbols and their values.
  let symbol = "schema:object"
  let value = {type: "object"}
  let typedValue = entryToValue(await db.oneOrNone(
    `
      SELECT * FROM objects
      INNER JOIN values ON objects.id = values.id
      INNER JOIN symbols ON objects.id = symbols.id
      WHERE schema_id = values.id
      AND widget_id IS NULL
      AND symbol = $<symbol>
    `,
    {
      symbol,
      value,
    },
  ))
  if (typedValue === null) {
    typedValue = entryToValue(await db.oneOrNone(
      `
        SELECT * FROM objects
        INNER JOIN values ON objects.id = values.id
        WHERE schema_id = values.id
        AND widget_id IS NULL
        AND value = $<value:json>
      `,
      {
        value,
      },
    ))
    if (typedValue === null) {
      let result = await db.one(`
        INSERT INTO objects(created_at, type)
        VALUES (current_timestamp, 'Value')
        RETURNING id
      `)
      typedValue = {
        id: result.id,
        value,
      }
      await db.none(
        `INSERT INTO values(id, schema_id, value, widget_id)
          VALUES ($<id>, $<id>, $<value:json>, NULL)`,
        typedValue,
      )
    }
    typedValue["symbol"] = symbol
    await db.none(
      `INSERT INTO symbols(id, symbol)
        VALUES ($<id>, $<symbol>)
        ON CONFLICT (symbol)
        DO UPDATE SET id = $<id>
        `,
      typedValue,
    )
  }
  idBySymbol[symbol] = typedValue.id
  symbolById[typedValue.id] = symbol

  for (let {keysOrder, schemaSymbol, schemasWidgetsOrder, symbol, value, widgetSymbol} of symbolizedTypedValues) {
    let initialValue = schemaSymbol === "schema:localized-string" ? "TO BE REPLACED LATER" : value

    let schemaId = getIdFromSymbol(schemaSymbol)
    let widgetId = getIdFromSymbol(widgetSymbol)
    let typedValue = entryToValue(await db.oneOrNone(
      `
        SELECT * FROM objects
        INNER JOIN values ON objects.id = values.id
        INNER JOIN symbols ON objects.id = symbols.id
        WHERE schema_id = $<schemaId>
        AND symbol = $<symbol>
      `,
      {
        schemaId,
        symbol,
      },
    ))
    if (typedValue === null) {
      typedValue = await getOrNewValueWithSymbol(schemaId, widgetId, initialValue, {symbol})
    } else {
      idBySymbol[symbol] = typedValue.id
      symbolById[typedValue.id] = symbol

      // Update widgetId in exiting typed value.
      if (typedValue.widgetId != widgetId) {
        typedValue.widgetId = widgetId
        await db.none(
          `
            UPDATE values
            SET widget_id = $<widgetId>
            WHERE id = $<id>
          `,
          typedValue,
        )
      }
    }

    if (schemaSymbol === "schema:localized-string") {
      // Creating a localized string, requires to create each of its strings.
      let properties = {}
      for (let [language, string] of Object.entries(value)) {
        let typedString = await getOrNewValueWithSymbol(getIdFromSymbol("schema:string"), widgetId, string)
        properties[getIdFromSymbol(language)] = typedString.id
      }
      typedValue.value = value = properties
      await db.none(
        `
          UPDATE values
          SET value = $<value:json>
          WHERE id = $<id>
        `,
        typedValue,
      )

      // Do an optimistic optimization.
      if (typedValue.properties === null) typedValue.properties = {}
      for (let [languageId, stringId] of Object.entries(value)) {
        if (typedValue.properties[languageId] === undefined) typedValue.properties[languageId] = stringId
      }
      await db.none(
        `
          UPDATE objects
          SET properties = $<properties:json>
          WHERE id = $<id>
        `,
        typedValue,
      )

      typedValue.propertyByKeyId = {}
      for (let [keyId, valueId] of Object.entries(properties)) {
        assert.strictEqual(typeof keyId, "string")
        assert.strictEqual(typeof valueId, "string")
        typedValue.propertyByKeyId[keyId] = await getOrNewProperty(typedValue.id, keyId, valueId)
      }
    }

    if (keysOrder) {
      await db.none(
        `
          INSERT INTO types(id, keys_order)
          VALUES ($<id>, $<keysOrder:json>)
          ON CONFLICT (id)
          DO UPDATE SET keys_order = $<keysOrder:json>
        `,
        {
          id: typedValue.id,
          keysOrder: keysOrder.map(getIdFromSymbol),
        }
      )
    } else {
      await db.none(
        `
          DELETE FROM types
          WHERE id = $<id>
        `,
        typedValue,
      )
    }

    if (schemasWidgetsOrder) {
      await db.none(
        `
          INSERT INTO keys(id, schemas_widgets_order)
          VALUES ($<id>, $<schemasWidgetsOrder:json>)
          ON CONFLICT (id)
          DO UPDATE SET schemas_widgets_order = $<schemasWidgetsOrder:json>
        `,
        {
          id: typedValue.id,
          schemasWidgetsOrder: schemasWidgetsOrder.map(([schemaSymbol, widgetSymbols]) => [
            getIdFromSymbol(schemaSymbol),
            widgetSymbols.map(getIdFromSymbol),
          ]),
        }
      )
    } else {
      await db.none(
        `
          DELETE FROM keys
          WHERE id = $<id>
        `,
        typedValue,
      )
    }
  }

  // Purge obsolete duplicate symbols.
  let symbolInfos = await db.any("SELECT id, symbol FROM symbols")
  for (let {id, symbol} of symbolInfos) {
    if (symbolById[id] !== undefined && symbolById[id] !== symbol) {
      console.log(`Deleting symbol "${symbol}, that is a duplicate of symbol ${symbolById[id]} for ID ${id}.`)
      await db.none("DELETE FROM symbols WHERE symbol = $1", symbol)
    }
  }
}


export async function getOrNewValueWithSymbol(schemaId, widgetId, value, {symbol = null} = {}) {
  // Custom (and partial and slower) version of getOrNewValue to avoid missing symbols during configuration of symbols.

  let typedValue = await getValue(schemaId, widgetId, value)
  if (typedValue === null) {
    let result = await db.one(
      `
        INSERT INTO objects(created_at, type)
        VALUES (current_timestamp, 'Value')
        RETURNING created_at, id, type
      `,
    )
    typedValue = {
      createdAt: result.created_at,
      id: result.id,
      properties: null,
      schemaId,
      symbol,
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
    // await generateObjectTextSearch(typedValue)
  }
  if (symbol) {
    typedValue.symbol = symbol
    await db.none(
      `INSERT INTO symbols(id, symbol)
        VALUES ($<id>, $<symbol>)
        ON CONFLICT (symbol)
        DO UPDATE SET id = $<id>
        `,
      typedValue,
    )
    idBySymbol[symbol] = typedValue.id
    symbolById[typedValue.id] = symbol
  }
  return typedValue
}


configureDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.log(error.stack || error)
    process.exit(1)
  })
