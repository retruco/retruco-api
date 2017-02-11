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


import path from "path"


export default {
  contact: {
    // email:
    name: process.env.RTAPI_CONTACT || "Retruco-API Team",
    // url:
  },
  db: {
    database: process.env.RTAPI_DB_NAME || "retruco",
    host: process.env.RTAPI_DB_HOST || "localhost",
    password: process.env.RTAPI_DB_PASSWORD || "password",
    port: process.env.RTAPI_DB_PORT || 5432,
    user: process.env.RTAPI_DB_USER || "username",
  },
  description: process.env.RTAPI_DESCRIPTION || "Bring out shared positions from argumented statements",
  email: process.env.RTAPI_EMAIL || "retruco@localhost",
  emailSignKey: process.env.RTAPI_EMAIL_KEY || "Retruco sign key",
  emailTemplates: path.normalize(path.join(__dirname, "..", "email-templates")),
  host: process.env.RTAPI_HOST || "localhost",
  keys: [
    // Keys for Keygrip <https://github.com/crypto-utils/keygrip>, used by signed cookie keys, etc
    process.env.RTAPI_KEY || "Retruco-API not very secret key, to override",
  ],
  languages: [
    "bg",
    "cs",
    "da",
    "de",
    "el",
    "en",
    "es",
    "et",
    "fi",
    "fr",
    "ga",
    "hr",
    "hu",
    "it",
    "lt",
    "lv",
    "mt",
    "nl",
    "pl",
    "pt",
    "ro",
    "sk",
    "sl",
    "sv",
  ],
  license: {
    // API license (not software license)
    name: "MIT",
    url: "http://opensource.org/licenses/MIT",
  },
  listen: {
    host: null,  // Listen to every IPv4 addresses.
    port: null,  // Listen to config.port by default
  },
  port: process.env.RTAPI_PORT || 3000,
  proxy: process.env.RTAPI_PROXY || false,  // Is this application used behind a trusted proxy?
  smtp: {
    host: process.env.SMTP_HOST || "localhost",
    port: process.env.SMTP_PORT || 25,
    secure: process.env.SMTP_SECURE || false,  // Use startTLS
    // auth: {
    //   user: "username",
    //   pass: "password",
    // },
    tls: {
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED || false,  // Accept self-signed certificates.
    },
  },
  title: process.env.RTAPI_TITLE ||"Retruco-API",
  uploads: path.normalize(path.join(__dirname, "..", "uploads")),
}
