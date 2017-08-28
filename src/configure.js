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

import assert from "assert"
import slugify from "slug"

import config from "./config"
import { db, versionNumber } from "./database"
import { entryToValue, getValue, types } from "./model"
import { regeneratePropertiesItem } from "./regenerators"
import { cleanupObjectsProperties, collectGarbage, replaceId } from "./repairs"
import { getIdFromSymbol, symbolizedTypedValues, idBySymbol, symbolById } from "./symbols"

async function configureDatabase() {
  // Check that database exists.
  await db.connect()

  // Table: version
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS version(
        number integer NOT NULL,
        text integer NOT NULL
      )
    `,
  )
  let version = await db.oneOrNone("SELECT * FROM version")
  if (version === null) {
    await db.none("INSERT INTO version(number, text) VALUES ($<number>, $<text>)", {
      number: versionNumber,
      text: 0,
    })
    version = await db.one("SELECT * FROM version")
  }
  assert(
    version.number <= versionNumber,
    `Database is too recent for current version of application: ${version.number} > ${versionNumber}.`,
  )
  if (version.number < versionNumber) {
    console.log(`Upgrading database from version ${version.number} to ${versionNumber}...`)
  }

  let requiresArgumentsRegeneration = false
  let requiresGarbageCollection = false
  let requiresPropertiesRegeneration = false

  if (version.number < 1) {
    // Remove non UNIQUE index to recreate it.
    await db.none("DROP INDEX IF EXISTS statements_hash_idx")
  }
  if (version.number < 5) {
    // Add support for trigrams.
    // TODO: Database user must be database owner.
    // await db.none("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    console.log(
      `
        YOU MUST manually execute the following SQL commands:
          CREATE EXTENSION IF NOT EXISTS pg_trgm;
      `,
    )
  }
  if (version.number < 7) {
    await db.none("ALTER TABLE version ADD COLUMN IF NOT EXISTS text integer")
    await db.none("UPDATE version SET text = $1", 0)
    await db.none("ALTER TABLE version ALTER COLUMN text SET NOT NULL")
  }
  if (version.number < 9) {
    console.log(
      `
        Database schema has changed and is not upgradable.
        YOU MUST manually execute the following SQL commands:
          DROP TABLE actions, ballots, statements, statements_autocomplete, statements_text_search, users CASCADE;
          DROP TYPE event_type, statement_type;
      `,
    )
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
  if (version.number < 23) {
    await db.none("DROP TABLE IF EXISTS cards_autocomplete")
    await db.none("DROP TABLE IF EXISTS cards_text_search")
    await db.none("DROP TABLE IF EXISTS users_autocomplete")
    await db.none("DROP TABLE IF EXISTS users_text_search")
    await db.none("DROP TABLE IF EXISTS values_autocomplete")
    await db.none("DROP TABLE IF EXISTS values_text_search")
  }
  if (version.number < 24) {
    await db.none("ALTER TABLE statements ADD COLUMN IF NOT EXISTS trashed boolean NOT NULL DEFAULT FALSE")
    requiresArgumentsRegeneration = true
  }
  if (version.number < 25) {
    await db.none("ALTER TABLE statements DROP COLUMN IF EXISTS arguments")
    await db.none("ALTER TABLE statements ADD COLUMN IF NOT EXISTS argument_count integer NOT NULL DEFAULT 0")
    requiresArgumentsRegeneration = true
  }
  if (version.number < 26) {
    // In table properties, replace:
    // value_id bigint NOT NULL REFERENCES values(id) ON DELETE RESTRICT
    // xith:
    // value_id bigint NOT NULL REFERENCES objects(id) ON DELETE RESTRICT
    await db.none("ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_value_id_fkey")
    await db.none(
      `
        ALTER TABLE properties
        ADD CONSTRAINT properties_value_id_fkey
        FOREIGN KEY (value_id)
        REFERENCES objects(id)
        ON DELETE RESTRICT
      `,
    )
  }

  // Languages sets

  await db.none(
    `
      CREATE TABLE IF NOT EXISTS languages_sets(
        id bigserial NOT NULL PRIMARY KEY,
        languages text[]
      )
    `,
  )
  await db.none(
    `
      CREATE INDEX IF NOT EXISTS languages_sets_languages_idx
      ON languages_sets
      USING GIN (languages)
    `,
  )

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
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS objects(
        created_at timestamp without time zone NOT NULL,
        id bigserial NOT NULL PRIMARY KEY,
        properties jsonb,
        sub_types text[],
        tags text[],
        type object_type NOT NULL,
        usages text[]
      )
    `,
  )
  await db.none("CREATE INDEX IF NOT EXISTS objects_created_at_idx ON objects(created_at)")
  await db.none(
    `
      CREATE INDEX IF NOT EXISTS objects_sub_types_idx
      ON objects
      USING GIN (sub_types)
    `,
  )
  await db.none(
    `
      CREATE INDEX IF NOT EXISTS objects_tags_idx
      ON objects
      USING GIN (tags)
    `,
  )

  // Table: objects_references
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS objects_references(
        source_id bigint NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
        target_id bigint NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
        PRIMARY KEY (source_id, target_id)
      )
    `,
  )
  await db.none("CREATE INDEX IF NOT EXISTS references_source_id_idx ON objects_references(source_id)")
  await db.none("CREATE INDEX IF NOT EXISTS references_target_id_idx ON objects_references(target_id)")

  // Table: symbols
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS symbols(
        id bigint NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
        symbol text NOT NULL PRIMARY KEY
      )
    `,
  )

  // Table: users
  await db.none(
    `
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
    `,
  )
  await db.none("CREATE UNIQUE INDEX IF NOT EXISTS users_api_key_idx ON users(api_key)")
  await db.none("CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email)")
  await db.none("CREATE UNIQUE INDEX IF NOT EXISTS users_url_name_idx ON users(url_name)")

  // Table: users_autocomplete
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS users_autocomplete(
        autocomplete text NOT NULL,
        id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        languages_set_id bigint NOT NULL REFERENCES languages_sets(id) ON DELETE CASCADE,
        PRIMARY KEY (id, languages_set_id)
      )
    `,
  )
  await db.none(
    `
      CREATE INDEX IF NOT EXISTS users_autocomplete_trigrams_idx
        ON users_autocomplete
        USING GIST (autocomplete gist_trgm_ops)
    `,
  )

  // Table: users_text_search
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS users_text_search(
        id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        languages_set_id bigint NOT NULL REFERENCES languages_sets(id) ON DELETE CASCADE,
        text_search tsvector,
        PRIMARY KEY (id, languages_set_id)
      )
    `,
  )
  await db.none(
    `
      CREATE INDEX IF NOT EXISTS users_text_search_idx
        ON users_text_search
        USING GIN (text_search)
    `,
  )

  // Table: values
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS values(
        id bigint NOT NULL PRIMARY KEY REFERENCES objects(id) ON DELETE CASCADE,
        schema_id bigint NOT NULL REFERENCES values(id) ON DELETE RESTRICT,
        value jsonb NOT NULL,
        widget_id bigint REFERENCES values(id) ON DELETE RESTRICT
      )
    `,
  )
  await db.none(
    `
      CREATE INDEX IF NOT EXISTS values_schema_id_value_idx
      ON values(schema_id, value)
    `,
  )
  await db.none(
    `
      CREATE INDEX IF NOT EXISTS values_value_idx
      ON values USING GIN (value jsonb_path_ops)
    `,
  )

  // Table: values_autocomplete
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS values_autocomplete(
        autocomplete text NOT NULL,
        id bigint NOT NULL REFERENCES values(id) ON DELETE CASCADE,
        languages_set_id bigint NOT NULL REFERENCES languages_sets(id) ON DELETE CASCADE,
        PRIMARY KEY (id, languages_set_id)
      )
    `,
  )
  await db.none(
    `
      CREATE INDEX IF NOT EXISTS values_autocomplete_trigrams_idx
        ON values_autocomplete
        USING GIST (autocomplete gist_trgm_ops)
    `,
  )

  // Table: values_text_search
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS values_text_search(
        id bigint NOT NULL REFERENCES values(id) ON DELETE CASCADE,
        languages_set_id bigint NOT NULL REFERENCES languages_sets(id) ON DELETE CASCADE,
        text_search tsvector,
        PRIMARY KEY (id, languages_set_id)
      )
    `,
  )
  await db.none(
    `
      CREATE INDEX IF NOT EXISTS values_text_search_idx
        ON values_text_search
        USING GIN (text_search)
    `,
  )

  // Rated Objects (aka statements)

  // Table: statements
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS statements(
        argument_count integer NOT NULL DEFAULT 0,
        id bigint NOT NULL PRIMARY KEY REFERENCES objects(id) ON DELETE CASCADE,
        rating double precision NOT NULL DEFAULT 0,
        rating_count integer NOT NULL DEFAULT 0,
        rating_sum integer NOT NULL DEFAULT 0,
        trashed boolean NOT NULL DEFAULT FALSE
      )
    `,
  )

  // Table: cards
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS cards(
        id bigint NOT NULL PRIMARY KEY REFERENCES statements(id) ON DELETE CASCADE
      )
    `,
  )

  // Table: cards_autocomplete
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS cards_autocomplete(
        autocomplete text NOT NULL,
        id bigint NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        languages_set_id bigint NOT NULL REFERENCES languages_sets(id) ON DELETE CASCADE,
        PRIMARY KEY (id, languages_set_id)
      )
    `,
  )
  await db.none(
    `
      CREATE INDEX IF NOT EXISTS cards_autocomplete_trigrams_idx
        ON cards_autocomplete
        USING GIST (autocomplete gist_trgm_ops)
    `,
  )

  // Table: cards_text_search
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS cards_text_search(
        id bigint NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        languages_set_id bigint NOT NULL REFERENCES languages_sets(id) ON DELETE CASCADE,
        text_search tsvector,
        PRIMARY KEY (id, languages_set_id)
      )
    `,
  )
  await db.none(
    `
      CREATE INDEX IF NOT EXISTS cards_text_search_idx
        ON cards_text_search
        USING GIN (text_search)
    `,
  )

  // Table: properties
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS properties(
        id bigint NOT NULL PRIMARY KEY REFERENCES statements(id) ON DELETE CASCADE,
        key_id bigint NOT NULL REFERENCES values(id) ON DELETE RESTRICT,
        object_id bigint NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
        value_id bigint NOT NULL REFERENCES objects(id) ON DELETE RESTRICT
      )
    `,
  )
  await db.none("CREATE INDEX IF NOT EXISTS properties_object_id_key_id_idx ON properties(object_id, key_id)")

  // Table: actions
  await db.none(
    `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
          CREATE TYPE event_type AS ENUM (
            'properties',
            'rating'
          );
        END IF;
      END$$
    `,
  )
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS actions(
        created_at timestamp without time zone NOT NULL,
        id bigserial NOT NULL PRIMARY KEY,
        object_id bigint NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
        type event_type NOT NULL,
        UNIQUE (object_id, type)
      )
    `,
  )
  await db.none("CREATE INDEX IF NOT EXISTS actions_created_at_idx ON actions(created_at)")
  await db.none("CREATE INDEX IF NOT EXISTS actions_type_object_id_idx ON actions(type, object_id)")
  await db.none(
    `
      CREATE OR REPLACE FUNCTION notify_new_action() RETURNS trigger AS $$
      BEGIN
        PERFORM pg_notify('new_action', '');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `,
  )
  try {
    await db.none("DROP TRIGGER action_inserted ON actions")
  } catch (e) {}
  await db.none(
    `
      CREATE TRIGGER action_inserted AFTER INSERT ON actions
      FOR EACH ROW
      EXECUTE PROCEDURE notify_new_action()
    `,
  )

  // Table: ballots
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS ballots(
        rating smallint CHECK (rating >= -1 AND rating <= 1),
        statement_id bigint NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
        updated_at timestamp without time zone NOT NULL,
        voter_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (statement_id, voter_id)
      )
    `,
  )
  await db.none("CREATE INDEX IF NOT EXISTS ballots_statement_id_idx ON ballots(statement_id)")
  // await db.none("CREATE INDEX IF NOT EXISTS ballots_updated_at_idx ON ballots(updated_at)")
  await db.none("CREATE INDEX IF NOT EXISTS ballots_voter_id_idx ON ballots(voter_id)")

  // Table: collections
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS collections(
        author bigint NOT NULL REFERENCES users(id),
        cards bigint[],
        created_at timestamp without time zone NOT NULL,
        description text,
        id bigserial NOT NULL PRIMARY KEY,
        logo text,
        name text NOT NULL
      )
    `,
  )
  await db.none("CREATE INDEX IF NOT EXISTS collections_author_idx ON collections(author)")

  // Table: keys
  // Contains the prefered schemas and widgets for each key of properties
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS keys(
        id bigint NOT NULL PRIMARY KEY REFERENCES values(id) ON DELETE CASCADE,
        schemas_widgets_order jsonb NOT NULL
      )
    `,
  )

  // Table: types
  // Contains the prefered keys for each type (of card).
  await db.none(
    `
      CREATE TABLE IF NOT EXISTS types(
        id bigint NOT NULL PRIMARY KEY REFERENCES values(id) ON DELETE CASCADE,
        keys_order jsonb NOT NULL
      )
    `,
  )

  const previousVersionNumber = version.number

  if (version.number < 2) {
    try {
      await db.none("DROP TRIGGER event_inserted ON events")
    } catch (e) {}
    await db.none("DROP TABLE IF EXISTS events")
  }
  if (version.number < 3) {
    console.log(
      `
        YOU MUST manually execute the following SQL commands:
          ALTER TYPE statement_type ADD VALUE IF NOT EXISTS 'Citation' AFTER 'Card';
          ALTER TYPE statement_type ADD VALUE IF NOT EXISTS 'Event' AFTER 'Citation';
          ALTER TYPE statement_type ADD VALUE IF NOT EXISTS 'Person' AFTER 'Event';
      `,
    )
  }
  if (version.number < 8) {
    console.log(
      `
        YOU MUST manually execute the following SQL commands:
          DROP TABLE actions, ballots, statements, statements_autocomplete, statements_text_search;
          DROP TYPE statement_type;
      `,
    )
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
  if (version.number < 20) {
    await db.none("ALTER TABLE cards_autocomplete RENAME COLUMN configuration_name TO language")
    await db.none("ALTER TABLE cards_text_search RENAME COLUMN configuration_name TO language")
    await db.none("ALTER TABLE concepts_autocomplete RENAME COLUMN configuration_name TO language")
    await db.none("ALTER TABLE concepts_text_search RENAME COLUMN configuration_name TO language")
    await db.none("ALTER TABLE users_autocomplete RENAME COLUMN configuration_name TO language")
    await db.none("ALTER TABLE users_text_search RENAME COLUMN configuration_name TO language")
    await db.none("ALTER TABLE values_autocomplete RENAME COLUMN configuration_name TO language")
    await db.none("ALTER TABLE values_text_search RENAME COLUMN configuration_name TO language")
    for (let tablePrefix of ["cards", "concepts", "users", "values"]) {
      for (let tableSuffix of ["autocomplete", "text_search"]) {
        let table = `${tablePrefix}_${tableSuffix}`
        for (let [configurationName, language] of [
          ["dutch", "nl"],
          ["english", "en"],
          ["french", "fr"],
          ["spanish", "es"],
        ]) {
          await db.none(
            `
              UPDATE ${table}
              SET language = $<language>
              WHERE language = $<configurationName>
            `,
            {
              configurationName,
              language,
            },
          )
        }
      }
    }
  }
  if (version.number < 21) {
    await db.none("ALTER TABLE statements ADD COLUMN IF NOT EXISTS arguments jsonb")
  }
  if (version.number < 22) {
    await db.none("DROP TABLE IF EXISTS concepts_autocomplete")
    await db.none("DROP TABLE IF EXISTS concepts_text_search")
    await db.none("DROP TABLE IF EXISTS concepts")
  }

  if (version.number < 26) {
    let idBySymbol = {}
    let results = await db.any("SELECT id, symbol FROM symbols")
    for (let { id, symbol } of results) {
      idBySymbol[symbol] = id
    }

    if (idBySymbol["schema:ids-array"] === undefined) {
      // schema:ids-array is not defined yet.
      let result = await db.one(
        `
          INSERT INTO objects(created_at, type)
          VALUES (current_timestamp, 'Value')
          RETURNING id
        `,
      )
      let schema = {
        id: result.id,
        schemaId: idBySymbol["schema:object"],
        symbol: "schema:ids-array",
        value: {
          type: "array",
          items: {
            $ref: "/schemas/id",
          },
        },
        widgetId: null,
      }
      await db.none(
        `
          INSERT INTO values(id, schema_id, value, widget_id)
          VALUES ($<id>, $<schemaId>, $<value:json>, $<widgetId>)
        `,
        schema,
      )
      await db.none(
        `
          INSERT INTO symbols(id, symbol)
          VALUES ($<id>, $<symbol>)
        `,
        schema,
      )
      idBySymbol["schema:ids-array"] = schema.id
    }

    await db.none("UPDATE values SET schema_id = $2 WHERE schema_id = $1", [
      idBySymbol["schema:card-ids-array"],
      idBySymbol["schema:ids-array"],
    ])

    await db.none("UPDATE values SET schema_id = $2 WHERE schema_id = $1", [
      idBySymbol["schema:value-ids-array"],
      idBySymbol["schema:ids-array"],
    ])

    let valueEntries = await db.any("SELECT * FROM values WHERE schema_id = $1", idBySymbol["schema:card-id"])
    for (let valueEntry of valueEntries) {
      await db.none("UPDATE properties SET value_id = $<value> WHERE value_id = $<id>", valueEntry)

      let arrayEntries = await db.any("SELECT * FROM values WHERE schema_id = $<schemaId> AND value @> $<id:json>", {
        id: valueEntry.id,
        schemaId: idBySymbol["schema:ids-array"],
      })
      for (let arrayEntry of arrayEntries) {
        arrayEntry.value = arrayEntry.value.map(id => (id === valueEntry.id ? valueEntry.value : id))
        await db.none("UPDATE values SET value = $<value:json> WHERE id = $<id>", arrayEntry)
      }
    }
    await db.none("DELETE FROM values WHERE schema_id = $1", idBySymbol["schema:card-id"])
  }

  if (version.number < 27) {
    let idBySymbol = {}
    let results = await db.any("SELECT id, symbol FROM symbols")
    for (let { id, symbol } of results) {
      idBySymbol[symbol] = id
    }

    if (idBySymbol["schema:ids-array"] === undefined) {
      // schema:ids-array is not defined yet.
      let result = await db.one(
        `
          INSERT INTO objects(created_at, type)
          VALUES (current_timestamp, 'Value')
          RETURNING id
        `,
      )
      let schema = {
        id: result.id,
        schemaId: idBySymbol["schema:object"],
        symbol: "schema:ids-array",
        value: {
          type: "array",
          items: {
            $ref: "/schemas/id",
          },
        },
        widgetId: null,
      }
      await db.none(
        `
          INSERT INTO values(id, schema_id, value, widget_id)
          VALUES ($<id>, $<schemaId>, $<value:json>, $<widgetId>)
        `,
        schema,
      )
      await db.none(
        `
          INSERT INTO symbols(id, symbol)
          VALUES ($<id>, $<symbol>)
        `,
        schema,
      )
      idBySymbol["schema:ids-array"] = schema.id
    }

    await db.none("UPDATE values SET schema_id = $2 WHERE schema_id = $1", [
      idBySymbol["schema:bijective-card-references-array"],
      idBySymbol["schema:ids-array"],
    ])

    let valueEntries = await db.any(
      "SELECT * FROM values WHERE schema_id = $1",
      idBySymbol["schema:bijective-card-reference"],
    )
    for (let valueEntry of valueEntries) {
      await db.none("UPDATE properties SET value_id = $<targetId> WHERE value_id = $<id>", {
        id: valueEntry.id,
        targetId: valueEntry.value.targetId,
      })

      let arrayEntries = await db.any("SELECT * FROM values WHERE schema_id = $<schemaId> AND value @> $<id:json>", {
        id: valueEntry.id,
        schemaId: idBySymbol["schema:ids-array"],
      })
      for (let arrayEntry of arrayEntries) {
        arrayEntry.value = arrayEntry.value.map(id => (id === valueEntry.id ? valueEntry.value.targetId : id))
        await db.none("UPDATE values SET value = $<value:json> WHERE id = $<id>", arrayEntry)
      }
    }
    await db.none("DELETE FROM values WHERE schema_id = $1", idBySymbol["schema:bijective-card-reference"])

    requiresPropertiesRegeneration = true
  }

  if (versionNumber < 28) {
    let idBySymbol = {}
    let results = await db.any("SELECT id, symbol FROM symbols")
    for (let { id, symbol } of results) {
      idBySymbol[symbol] = id
    }

    const localizedStringSchemaId = idBySymbol["schema:localized-string"]
    let languageSymbols = [...config.languages]
    languageSymbols.splice(languageSymbols.indexOf("en"), 1)
    languageSymbols.unshift("en")

    while (true) {
      let localizedString = await db.oneOrNone(
        `
          SELECT *
          FROM values
          WHERE schema_id = $<localizedStringSchemaId>
          LIMIT 1
        `,
        {
          localizedStringSchemaId,
        },
      )
      if (localizedString === null) {
        break
      }
      for (let languageSymbol of languageSymbols) {
        let localizationProperty = await db.oneOrNone(
          `
            SELECT properties.*
            FROM objects
            INNER JOIN statements ON objects.id = statements.id
            INNER JOIN properties ON statements.id = properties.id
            WHERE key_id = $<keyId>
            AND object_id = $<objectId>
            ORDER BY rating_sum DESC, created_at DESC
            LIMIT 1
          `,
          {
            keyId: await getUpdatedIdForSymbol(languageSymbol),
            objectId: localizedString.id,
          },
        )
        if (localizationProperty !== null) {
          await replaceId(localizedString.id, localizationProperty.value_id, idBySymbol)
          break
        }
      }
    }
  }

  await configureSymbols()

  version.number = versionNumber
  assert(
    version.number >= previousVersionNumber,
    `Error in database upgrade script: Wrong version number: ${version.number} < ${previousVersionNumber}.`,
  )
  if (version.number !== previousVersionNumber) {
    await db.none("UPDATE version SET number = $1", version.number)
    console.log(`Upgraded database from version ${previousVersionNumber} to ${version.number}.`)
  }

  if (requiresPropertiesRegeneration) {
    await cleanupObjectsProperties()

    console.log("Regenerating properties...")
    let entries = await db.any(
      `
        SELECT object_id, key_id
        FROM properties
        GROUP BY object_id, key_id
        ORDER BY object_id, key_id
      `,
    )
    let previousObjectId = null
    for (let entry of entries) {
      if (entry.object_id !== previousObjectId) {
        console.log(`  Regenerating properties of object ${entry.object_id}...`)
        previousObjectId = entry.object_id
      }
      await regeneratePropertiesItem(entry.object_id, entry.key_id, { quiet: true })
    }
    requiresGarbageCollection = true
    console.log("All properties have been regenerated.")
  }

  if (requiresArgumentsRegeneration) {
    console.log("You must manually execute regenerate-arguments.js.")
  }

  if (requiresGarbageCollection) {
    await collectGarbage()
  }
}

async function configureSymbols() {
  // Create missing symbols and their values.

  for (let { symbol } of symbolizedTypedValues) {
    assert.strictEqual(symbol.replace(/:/g, ""), slugify(symbol, { mode: "rfc3986" }))
  }

  let symbol = "schema:object"
  let value = { type: "object" }
  let typedValue = entryToValue(
    await db.oneOrNone(
      `
        SELECT objects.*, values.*, argument_count, rating, rating_count, rating_sum, symbol, trashed FROM objects
        INNER JOIN values ON objects.id = values.id
        LEFT JOIN statements ON objects.id = statements.id
        INNER JOIN symbols ON objects.id = symbols.id
        WHERE schema_id = values.id
        AND widget_id IS NULL
        AND symbol = $<symbol>
      `,
      {
        symbol,
        value,
      },
    ),
  )
  if (typedValue === null) {
    typedValue = entryToValue(
      await db.oneOrNone(
        `
          SELECT objects.*, values.*, argument_count, rating, rating_count, rating_sum, trashed FROM objects
          INNER JOIN values ON objects.id = values.id
          LEFT JOIN statements ON objects.id = statements.id
          WHERE schema_id = values.id
          AND widget_id IS NULL
          AND value = $<value:json>
        `,
        {
          value,
        },
      ),
    )
    if (typedValue === null) {
      let result = await db.one(
        `
          INSERT INTO objects(created_at, type)
          VALUES (current_timestamp, 'Value')
          RETURNING id
        `,
      )
      typedValue = {
        id: result.id,
        value,
      }
      await db.none(
        `
          INSERT INTO values(id, schema_id, value, widget_id)
          VALUES ($<id>, $<id>, $<value:json>, NULL)
        `,
        typedValue,
      )
    }
    typedValue["symbol"] = symbol
    await db.none(
      `
        INSERT INTO symbols(id, symbol)
        VALUES ($<id>, $<symbol>)
        ON CONFLICT (symbol)
        DO UPDATE SET id = $<id>
      `,
      typedValue,
    )
  }
  idBySymbol[symbol] = typedValue.id
  symbolById[typedValue.id] = symbol

  for (let { keysOrder, schemaSymbol, schemasWidgetsOrder, symbol, value, widgetSymbol } of symbolizedTypedValues) {
    let schemaId = getIdFromSymbol(schemaSymbol)
    let widgetId = getIdFromSymbol(widgetSymbol)
    let typedValue = entryToValue(
      await db.oneOrNone(
        `
          SELECT objects.*, values.*, argument_count, rating, rating_count, rating_sum, symbol, trashed FROM objects
          INNER JOIN values ON objects.id = values.id
          LEFT JOIN statements ON objects.id = statements.id
          INNER JOIN symbols ON objects.id = symbols.id
          WHERE schema_id = $<schemaId>
          AND symbol = $<symbol>
        `,
        {
          schemaId,
          symbol,
        },
      ),
    )
    if (typedValue === null) {
      typedValue = await getOrNewValueWithSymbol(schemaId, widgetId, value, { symbol })
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
        },
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
        },
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
  for (let { id, symbol } of symbolInfos) {
    if (symbolById[id] !== undefined && symbolById[id] !== symbol) {
      console.log(`Deleting symbol "${symbol}, that is a duplicate of symbol ${symbolById[id]} for ID ${id}.`)
      await db.none("DELETE FROM symbols WHERE symbol = $1", symbol)
    }
  }
}

export async function getOrNewValueWithSymbol(schemaId, widgetId, value, { symbol = null } = {}) {
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
      `
        INSERT INTO symbols(id, symbol)
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

async function getUpdatedIdForSymbol(symbol) {
  let entry = await db.one(
    `
      SELECT id
      FROM symbols
      WHERE symbol = $<symbol>
    `,
    {
      symbol,
    },
  )
  return entry.id
}

configureDatabase().then(() => process.exit(0)).catch(error => {
  console.log(error.stack || error)
  process.exit(1)
})
