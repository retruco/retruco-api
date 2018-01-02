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

import { PubSub, withFilter } from "graphql-subscriptions"
import { makeExecutableSchema } from "graphql-tools"
import GraphQLJSON from "graphql-type-json"
import Redis from "ioredis"

import config from "../config"
import { db } from "../database"
import { entryToUser, getObjectFromId, toDataJson, toObjectJson, toUserJson } from "../model"
import { getIdFromIdOrSymbol } from "../symbols"

const pubsub = new PubSub()
const redis = new Redis(config.redis)
const typeDefs = `
  scalar JSON

  type Ballot {
    id: String!
    rating: Int!
    statementId: String!
    updatedAt: String!
    voterId: String!
  }
  type Card implements Statement {
    argumentCount: Int!
    ballotId: String
    createdAt: String!
    id: String!
    qualities: [QualityItem!]
    ratingCount: Int!
    ratingSum: Int!
    trashed: Boolean
    type: String!
  }
  type DataWithId {
    ballots: [Ballot!]
    cards: [Card!]
    id: String!
    properties: [Property!]
    values: [Value!]
  }
  interface Object {
    createdAt: String!
    id: String!
    type: String!
  }
  type Property implements Statement {
    argumentCount: Int!
    ballotId: String
    createdAt: String!
    id: String!
    keyId: String!
    objectId: String!
    qualities: [QualityItem!]
    ratingCount: Int!
    ratingSum: Int!
    trashed: Boolean
    type: String!
    value: Statement!
    valueId: String!
  }
  type QualityItem {
    keyId: String!
    valueIds: [String]
  }
  interface Statement {
    argumentCount: Int!
    ballotId: String
    createdAt: String!
    id: String!
    qualities: [QualityItem!]
    ratingCount: Int!
    ratingSum: Int!
    trashed: Boolean
    type: String!
  }
  type User implements Object {
    activated: Boolean!
    createdAt: String!
    email: String
    id: String!
    isAdmin: Boolean!
    name: String!
    type: String!
    urlName: String!
  }
  type Value implements Statement {
    argumentCount: Int!
    ballotId: String
    createdAt: String!
    id: String!
    qualities: [QualityItem!]
    ratingCount: Int!
    ratingSum: Int!
    schemaId: String!
    trashed: Boolean
    type: String!
    value: JSON
    widgetId: String
  }

  # the schema allows the following query:
  type Query {
    # statements: [Statement]
    users: [User!]
    user(id: String!): User
  }
  # this schema allows the following mutation:
  # type Mutation {
  #   upvoteStatement (
  #     statementId: String!
  #   ): Statement
  # }
  type Subscription {
    objectUpserted (
      apiKey: String
      need: [String!]
    ) : DataWithId
    propertyUpserted (
      objectIds: [String!]
      keyIds: [String!]
      valueIds: [String!]
    ) : Property
  }
`
const resolvers = {
  JSON: GraphQLJSON,
  Property: {
    async value(property) {
      console.log("resolvers.Property.value", property)
      const value = await getObjectFromId(property.valueId)
      return await toObjectJson(value, { graphql: true })
    },
  },
  // Mutation: {
  // upvoteStatement: (_, { statementId }) => {
  //   const post = find(posts, { id: postId });
  //   if (!post) {
  //     throw new Error(`Couldn't find post with id ${postId}`);
  //   }
  //   post.votes += 1;
  //   return post;
  // },
  // },
  // Author: {
  //   posts: (author) => filter(posts, { authorId: author.id }),
  // },
  // Post: {
  //   author: (post) => find(authors, { id: post.authorId }),
  // },
  Query: {
    async users() {
      const users = (await db.any(
        `
          SELECT objects.*, users.* FROM objects
          INNER JOIN users ON objects.id = users.id
        `,
      )).map(entryToUser)
      return users.map(toUserJson)
    },
    async user(_, { id }) {
      const user = entryToUser(
        await db.oneOrNone(
          `
          SELECT objects.*, users.* FROM objects
          INNER JOIN users ON objects.id = users.id
          WHERE objects.id = $1
        `,
          id,
        ),
      )
      return user === null ? null : toUserJson(user)
    },
  },
  Statement: {
    __resolveType(statement) {
      return statement.type
    },
  },
  Subscription: {
    objectUpserted: {
      resolve: async (object, { apiKey, need }) => {
        let user = null
        if (apiKey) {
          user = entryToUser(
            await db.oneOrNone(
              `
                SELECT * FROM objects
                INNER JOIN users ON objects.id = users.id
                WHERE api_key = $1
              `,
              apiKey,
            ),
          )
        }
        need = new Set((need || []).map(getIdFromIdOrSymbol))
        const dataWithId = await toDataJson(object, user, {
          graphql: true,
          need,
          showBallots: !!user,
        })

        // Convert dictionaries to lists.
        for (let name of ["ballots", "cards", "properties", "users", "values"]) {
          if (dataWithId[name]) {
            dataWithId[name] = Object.values(dataWithId[name])
          }
        }
        return dataWithId
      },
      subscribe: withFilter(
        () => pubsub.asyncIterator("objectUpserted"),
        (/* object, variables, context, info */) => {
          return true
        },
      ),
    },
    propertyUpserted: {
      resolve: async property => {
        return await toObjectJson(property, { graphql: true })
      },
      subscribe: withFilter(
        () => pubsub.asyncIterator("objectUpserted"),
        (object, { keyIds, objectIds, valueIds }) => {
          if (object.type !== "Property") {
            return false
          }
          const property = object
          if (keyIds && keyIds.length > 0) {
            keyIds = keyIds.map(getIdFromIdOrSymbol)
            if (!keyIds.includes(property.keyId)) {
              return false
            }
          }
          if (objectIds && objectIds.length > 0) {
            objectIds = objectIds.map(getIdFromIdOrSymbol)
            if (!objectIds.includes(property.objectId)) {
              return false
            }
          }
          if (valueIds && valueIds.length > 0) {
            valueIds = valueIds.map(getIdFromIdOrSymbol)
            if (!valueIds.includes(property.valueId)) {
              return false
            }
          }
          return true
        },
      ),
    },
  },
}

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})

redis.on("message", async function(channel, message) {
  if (channel === "objectUpserted") {
    const id = message
    const object = await getObjectFromId(id)
    pubsub.publish("objectUpserted", object)
  } else {
    console.warn(`Received Redis message ignored: ${channel} - ${message}`)
  }
})

redis.subscribe("objectUpserted")
