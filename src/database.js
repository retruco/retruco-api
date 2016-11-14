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
import crypto from "crypto"
import pgPromiseFactory from "pg-promise"

import config from "./config"


export const languageConfigurationNameByCode = {
  en: "english",
  fr: "french",
  es: "spanish",
}


const pgPromise = pgPromiseFactory()
export const db = pgPromise({
  database: config.db.database,
  host: config.db.host,
  password: config.db.password,
  port: config.db.port,
  user: config.db.user,
})
export let dbSharedConnectionObject = null

export const versionNumber = 7
export const versionTextSearchNumber = 1


export {checkDatabase}
async function checkDatabase({ignoreTextSearchVersion = false} = {}) {
  // Check that database exists.
  dbSharedConnectionObject = await db.connect()

  assert(await existsTable("version"), 'Database is not initialized. Run "node configure" to configure it.')

  let version = await db.one("SELECT * FROM version")
  assert(version.number <= versionNumber, "Database format is too recent. Upgrade Retruco-API.")
  assert.strictEqual(version.number, versionNumber, 'Database must be upgraded. Run "node configure" to configure it.')
  assert(version.text <= versionTextSearchNumber, "Text search is too recent. Upgrade Retruco-API.")
  if (!ignoreTextSearchVersion) {
    assert.strictEqual(version.text, versionTextSearchNumber,
      'Text search must be upgraded. Run "regenerate-text-search.js" to regenerate text search indexes.')
  }
}


export {configure}
async function configure() {
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

  // Table: statements
  await db.none(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statement_type') THEN
        CREATE TYPE statement_type AS ENUM (
          'Abuse',
          'Argument',
          'Card',
          'Citation',
          'Event',
          'Person',
          'PlainStatement',
          'Property',
          'Tag'
        );
      END IF;
    END$$
  `)
  await db.none(`
    CREATE TABLE IF NOT EXISTS statements(
      created_at timestamp without time zone NOT NULL,
      hash text NOT NULL,
      id bigserial NOT NULL PRIMARY KEY,
      rating double precision NOT NULL DEFAULT 0,
      rating_count integer NOT NULL DEFAULT 0,
      rating_sum integer NOT NULL DEFAULT 0,
      type statement_type NOT NULL,
      data jsonb NOT NULL
    )
  `)
  await db.none(`CREATE INDEX IF NOT EXISTS statements_card_type_idx ON statements((data->'values'->'Card Type'))
    WHERE data->'values'->'Card Type' IS NOT NULL`)
  await db.none(`CREATE INDEX IF NOT EXISTS statements_claim_id_idx ON statements((data->>'claimId'))
    WHERE data->>'claimId' IS NOT NULL`)
  await db.none(`
    CREATE INDEX IF NOT EXISTS statements_claim_id_ground_id_idx
      ON statements((data->>'claimId'), (data->>'groundId'))
      WHERE data->>'claimId' IS NOT NULL and data->>'groundId' IS NOT NULL
  `)
  await db.none("CREATE INDEX IF NOT EXISTS statements_created_at_idx ON statements(created_at)")
  await db.none(`CREATE INDEX IF NOT EXISTS statements_ground_id_idx ON statements((data->>'groundId'))
    WHERE data->>'groundId' IS NOT NULL`)
  await db.none("CREATE UNIQUE INDEX IF NOT EXISTS statements_hash_idx ON statements(hash)")
  await db.none(`
    CREATE INDEX IF NOT EXISTS statements_tag_statement_id_name_idx
      ON statements((data->>'statementId'), (data->>'name'))
      WHERE type = 'Tag'
  `)
  await db.none("CREATE INDEX IF NOT EXISTS statements_tags_idx ON statements USING GIN ((data->'tags'))")
  await db.none(`
    CREATE INDEX IF NOT EXISTS statements_type_statement_id_idx
      ON statements(type, (data->>'statementId'))
      WHERE type IN ('Abuse', 'Property', 'Tag')
  `)

  // Table: statements_autocomplete
  await db.none(`
    CREATE TABLE IF NOT EXISTS statements_autocomplete(
      autocomplete text NOT NULL,
      statement_id bigint NOT NULL PRIMARY KEY REFERENCES statements(id) ON DELETE CASCADE
    )
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS statements_autocomplete_trigrams_idx
      ON statements_autocomplete
      USING GIST (autocomplete gist_trgm_ops)
  `)

  // Table: statements_text_search
  await db.none(`
    CREATE TABLE IF NOT EXISTS statements_text_search(
      configuration_name text NOT NULL,
      statement_id bigint NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
      text_search tsvector,
      PRIMARY KEY (statement_id, configuration_name)
    )
  `)
  await db.none(`
    CREATE INDEX IF NOT EXISTS statements_text_search_idx
      ON statements_text_search
      USING GIN (text_search)
  `)

  // Table: users
  await db.none(`
    CREATE TABLE IF NOT EXISTS users(
      api_key text NOT NULL,
      created_at timestamp without time zone NOT NULL,
      email text NOT NULL,
      id bigserial NOT NULL PRIMARY KEY,
      is_admin boolean NOT NULL DEFAULT FALSE,
      name text NOT NULL,
      password_digest text NOT NULL,
      salt text NOT NULL,
      url_name text NOT NULL
    )
  `)
  await db.none("CREATE INDEX IF NOT EXISTS users_api_key_idx ON users(api_key)")
  await db.none("CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at)")
  await db.none("CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)")
  await db.none("CREATE INDEX IF NOT EXISTS users_url_name_idx ON users(url_name)")

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

  // Table: actions
  await db.none(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
        CREATE TYPE event_type AS ENUM (
          'rating'
        );
      END IF;
    END$$
  `)
  await db.none(`
    CREATE TABLE IF NOT EXISTS actions(
      created_at timestamp without time zone NOT NULL,
      id bigserial NOT NULL PRIMARY KEY,
      statement_id bigint NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
      type event_type NOT NULL
    )
  `)
  await db.none("CREATE INDEX IF NOT EXISTS actions_created_at_idx ON actions(created_at)")
  await db.none("CREATE INDEX IF NOT EXISTS actions_type_statement_id_idx ON actions(type, statement_id)")
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

  const previousVersionNumber = version.number

  if (version.number <= 1) {
    try {
      await db.none("DROP TRIGGER event_inserted ON events")
    } catch (e) {}
    await db.none("DROP TABLE IF EXISTS events")
  }
  if (version.number <= 2) {
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
  if (version.number <= 3) {
    let statements = (await db.any("SELECT * FROM statements")).map(entryToStatement)
    for (let statement of statements) {
      await generateStatementTextSearch(statement)
    }
  }

  version.number = versionNumber
  assert(version.number >= previousVersionNumber,
    `Error in database upgrade script: Wrong version number: ${version.number} < ${previousVersionNumber}.`)
  if (version.number !== previousVersionNumber) {
    await db.none("UPDATE version SET number = $1", version.number)
    console.log(`Upgraded database from version ${previousVersionNumber} to ${version.number}.`)
  }
}


export {entryToBallot}
function entryToBallot(entry) {
  return entry === null ? null : {
    id: `${entry.statement_id}/${entry.voter_id}`,
    rating: parseInt(entry.rating),
    statementId: entry.statement_id,
    updatedAt: entry.updated_at,
    voterId: entry.voter_id,
  }
}


export {entryToAction}
function entryToAction(entry) {
  return entry === null ? null : {
    createdAt: entry.created_at,
    id: entry.id,  // Use string for id.
    statementId: entry.statement_id,
    type: entry.type,
  }
}


export {entryToStatement}
function entryToStatement(entry) {
  return entry === null ? null : {
    ...(entry.data || {}),
    createdAt: entry.created_at,
    hash: entry.hash,
    id: entry.id,  // Use string for id.
    rating: entry.rating,
    ratingCount: entry.rating_count,
    ratingSum: entry.rating_sum,
    type: entry.type,
  }
}


export {entryToUser}
function entryToUser(entry) {
  return entry === null ? null : {
    apiKey: entry.api_key,
    createdAt: entry.created_at,
    email: entry.email,
    id: entry.id,  // Use string for id.
    isAdmin: entry.is_admin,
    name: entry.name,
    passwordDigest: entry.password_digest,
    salt: entry.salt,
    urlName: entry.url_name,
  }
}


async function existsTable(tableName) {
  return (await db.one("SELECT EXISTS(SELECT * FROM information_schema.tables WHERE table_name=$1)", [tableName]))
    .exists
}


export {generateStatementTextSearch}
async function generateStatementTextSearch(statement) {
  let autocomplete = null
  let languageConfigurationNames = []
  let searchableText = null
  if (statement.type === "Card") {
    // TODO: Handle card languages.
    languageConfigurationNames = config.languageCodes.map(languageCode => languageConfigurationNameByCode[languageCode])
    let values = statement.values
    if (values) {
      for (let key of ["Name", "name", "Title", "title"]) {
        let value = values[key]
        if (value !== null && value !== undefined && value !== "") {
          autocomplete = String(value)
          break
        }
      }
      autocomplete = autocomplete ? `${autocomplete} #${statement.id}` : `#${statement.id}`
      searchableText = [
        values["Name"],
        values["name"],
        values["Title"],
        values["title"],
      ].filter(value => value !== null && value !== undefined && value !== "").map(String).join(" ")
    }
  } else if (statement.type === "Event") {
    autocomplete = statement.name
    languageConfigurationNames = config.languageCodes.map(languageCode => languageConfigurationNameByCode[languageCode])
    searchableText = statement.name
  } else if (statement.type === "PlainStatement") {
    autocomplete = statement.name
    languageConfigurationNames = [languageConfigurationNameByCode[statement.languageCode]]
    searchableText = statement.name
  } else if (statement.type === "Person") {
    autocomplete = statement.name
    if (statement.twitterName) autocomplete = `${autocomplete} (${statement.twitterName})`
    languageConfigurationNames = config.languageCodes.map(languageCode => languageConfigurationNameByCode[languageCode])
    searchableText = [statement.name, statement.twitterName].filter(Boolean).join(" ")
  }

  if (!autocomplete) {
    await db.none("DELETE FROM statements_autocomplete WHERE statement_id = $1", statement.id)
  } else {
    await db.none(
      `INSERT INTO statements_autocomplete(statement_id, autocomplete)
        VALUES ($1, $2)
        ON CONFLICT (statement_id)
        DO UPDATE SET autocomplete = $2
      `,
      [statement.id, autocomplete],
    )
  }

  if (!searchableText || languageConfigurationNames.length === 0) {
    await db.none("DELETE FROM statements_text_search WHERE statement_id = $1", statement.id)
  } else {
    for (let languageConfigurationName of languageConfigurationNames) {
      await db.none(
        `INSERT INTO statements_text_search(statement_id, configuration_name, text_search)
          VALUES ($1, $2, to_tsvector($2, $3))
          ON CONFLICT (statement_id, configuration_name)
          DO UPDATE SET text_search = to_tsvector($2, $3)
        `,
        [statement.id, languageConfigurationName, searchableText],
      )
    }
    await db.none(
      "DELETE FROM statements_text_search WHERE statement_id = $1 AND configuration_name NOT IN ($2:csv)",
      [statement.id, languageConfigurationNames],
    )
  }
}


export function hashStatement(statementType, statement) {
  // Two statements have the same hash if and only if the statements have exactly the same content (except ID, dates,
  // etc).
  const hash = crypto.createHash("sha256")
  hash.update(statementType)
  if (statementType === "Abuse") {
    hash.update(statement.statementId)
  } else if (statementType === "Argument") {
    hash.update(statement.claimId)
    hash.update(statement.groundId)
  } else if (statementType === "Card") {
    // TODO: Hash what?
    if (statement.randomId) hash.update(statement.randomId)
  } else if (statementType === "Citation") {
    hash.update(statement.citedId)
    hash.update(statement.eventId)
    hash.update(statement.personId)
  } else if (statementType === "Event") {
    hash.update(statement.name)
  } else if (statementType === "Person") {
    hash.update(statement.name)
  } else if (statementType === "PlainStatement") {
    hash.update(statement.languageCode)
    hash.update(statement.name)
  } else if (statementType === "Property") {
    hash.update(statement.statementId)
    // hash.update(statement.languageCode)
    hash.update(statement.name)
    hash.update(JSON.stringify(statement.schema))
    hash.update(JSON.stringify(statement.widget))
    hash.update(JSON.stringify(statement.value))
  } else if (statementType === "Tag") {
    hash.update(statement.statementId)
    hash.update(statement.name)
  }
  return hash.digest("base64")
}
