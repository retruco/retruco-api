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
import pgPromiseFactory from "pg-promise"

import config from "./config"


const pgPromise = pgPromiseFactory()
export const db = pgPromise({
  database: config.db.database,
  host: config.db.host,
  password: config.db.password,
  port: config.db.port,
  user: config.db.user,
})


const versionNumber = 1


export {checkDatabase}
async function checkDatabase() {
  // Check that database exists.
  await db.connect()

  assert(await existsTable("version"), 'Database is not initialized. Run "node configure" to configure it.')

  let version = await db.one(`SELECT * FROM version`)
  assert(version.number <= versionNumber, "Database format is too recent. Upgrade Retruco-API.")
  assert.strictEqual(version.number, versionNumber, 'Database must be upgraded. Run "node configure" to configure it.')
}


export {configure}
async function configure() {
  // Check that database exists.
  await db.connect()

  // Table: version
  await db.none(`
    CREATE TABLE IF NOT EXISTS version(
      number integer NOT NULL
    )
  `)
  let version = await db.oneOrNone(`SELECT * FROM version`)
  if (version === null) {
    await db.none(`INSERT INTO version(number) VALUES (0)`)
    version = await db.one(`SELECT * FROM version`)
  }

  if (version.number === 0) {
    // Remove non UNIQUE index to recreate it.
    await db.none(`DROP INDEX IF EXISTS statements_hash_idx`)
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
  await db.none(`CREATE INDEX IF NOT EXISTS statements_claim_id_idx ON statements((data->>'claimId'))
    WHERE data->>'claimId' IS NOT NULL`)
  await db.none(`
    CREATE INDEX IF NOT EXISTS statements_claim_id_ground_id_idx
      ON statements((data->>'claimId'), (data->>'groundId'))
      WHERE data->>'claimId' IS NOT NULL and data->>'groundId' IS NOT NULL
    `)
  await db.none(`CREATE INDEX IF NOT EXISTS statements_created_at_idx ON statements(created_at)`)
  await db.none(`CREATE INDEX IF NOT EXISTS statements_ground_id_idx ON statements((data->>'groundId'))
    WHERE data->>'groundId' IS NOT NULL`)
  await db.none(`CREATE UNIQUE INDEX IF NOT EXISTS statements_hash_idx ON statements(hash)`)
  await db.none(`
    CREATE INDEX IF NOT EXISTS statements_tag_statement_id_name_idx
      ON statements((data->>'statementId'), (data->>'name'))
      WHERE type = 'Tag'
    `)
  await db.none(`CREATE INDEX IF NOT EXISTS statements_tags_idx ON statements USING GIN ((data->'tags'))`)
  await db.none(`
    CREATE INDEX IF NOT EXISTS statements_type_statement_id_idx
      ON statements(type, (data->>'statementId'))
      WHERE type IN ('Abuse', 'Property', 'Tag')
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
  await db.none(`CREATE INDEX IF NOT EXISTS users_api_key_idx ON users(api_key)`)
  await db.none(`CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at)`)
  await db.none(`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)`)
  await db.none(`CREATE INDEX IF NOT EXISTS users_url_name_idx ON users(url_name)`)

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
  await db.none(`CREATE INDEX IF NOT EXISTS ballots_statement_id_idx ON ballots(statement_id)`)
  // await db.none(`CREATE INDEX IF NOT EXISTS ballots_updated_at_idx ON ballots(updated_at)`)
  await db.none(`CREATE INDEX IF NOT EXISTS ballots_voter_id_idx ON ballots(voter_id)`)

  // Table: events
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
    CREATE TABLE IF NOT EXISTS events(
      created_at timestamp without time zone NOT NULL,
      id bigserial NOT NULL PRIMARY KEY,
      statement_id bigint NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
      type event_type NOT NULL
    )
  `)
  await db.none(`CREATE INDEX IF NOT EXISTS events_created_at_idx ON events(created_at)`)
  await db.none(`CREATE INDEX IF NOT EXISTS events_type_statement_id_idx ON events(type, statement_id)`)
  await db.none(`
    CREATE OR REPLACE FUNCTION notify_new_event() RETURNS trigger AS $$
    BEGIN
      PERFORM pg_notify('new_event', '');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)
  try {
    await db.none(`DROP TRIGGER event_inserted ON events`)
  } catch (e) {}
  await db.none(`
    CREATE TRIGGER event_inserted AFTER INSERT ON events
    FOR EACH ROW
    EXECUTE PROCEDURE notify_new_event()
  `)

  const previousVersionNumber = version.number

  if (version.number === 0) version.number += 1
  // if (version.number === 1) version.number += 1
  // if (version.number === 2) {
  //   // Add type to statements.
  //   let statementsId = await statementsTable
  //     .filter(r.row.hasFields("type").not())
  //     .getField("id")
  //   for (let statementId of statementsId) {
  //     await statementsTable
  //       .get(statementId)
  //       .update({
  //         type: "PlainStatement",
  //       })
  //   }
  //   version.number += 1
  // }
  // if (version.number === 3) version.number += 1
  // if (version.number === 4) version.number += 1
  // if (version.number === 5) version.number += 1
  // if (version.number === 6) {
  //   let users = await usersTable.filter(r.row.hasFields("email").not())
  //   for (let user of users) {
  //     await usersTable
  //       .get(user.id)
  //       .update({
  //         email: `${user.urlName}@localhost`,
  //       })
  //   }
  //   version.number += 1
  // }
  // if (version.number === 7) version.number += 1
  // if (version.number === 8) {
  //   let statements = await statementsTable
  //   for (let statement of statements) {
  //     hashStatement(statement)
  //     await statementsTable
  //       .get(statement.id)
  //       .update({
  //         hash: statement.hash,
  //       })
  //   }
  //   version.number += 1
  // }
  // if (version.number === 9) {
  //   let arguments1 = await statementsTable.getAll("Argument", {index: "type"})
  //   for (let argument of arguments1) {
  //       if (!argument.argumentType) {
  //       await statementsTable
  //         .get(argument.id)
  //         .update({
  //           argumentType: "because",
  //         })
  //     }
  //   }
  //   version.number += 1
  // }


  assert(version.number <= versionNumber,
    `Error in database upgrade script: Wrong version number: ${version.number} > ${versionNumber}.`)
  assert(version.number >= previousVersionNumber,
    `Error in database upgrade script: Wrong version number: ${version.number} < ${previousVersionNumber}.`)
  if (version.number !== previousVersionNumber) await db.none(`UPDATE version SET number = $1`, [version.number])

  // if (version.number !== previousVersionNumber) await versionTable.get(version.id).update({number: version.number})
}


export {entryToBallot}
function entryToBallot(entry) {
  return entry === null ? null : {
    rating: parseInt(entry.rating),
    statementId: entry.statement_id,
    updatedAt: entry.updated_at,
    voterId: entry.voter_id,
  }
}


export {entryToEvent}
function entryToEvent(entry) {
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
