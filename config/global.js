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

/*jshint esversion: 6 */
import path from "path";


export default {
  contact: {
    // email:
    name: "Retruco-API Team",
    // url:
  },
  db: {
    database: "retruco",
    host: "localhost",
    password: "password",
    port: 5432,
    user: "username",
  },
  description: "Bring out shared positions from argumented statements",
  email: "retruco@localhost",
  emailSignKey: "Retruco sign key",
  emailTemplates: path.normalize(path.join(__dirname, "..", "email-templates")),
  host: "localhost",
  keys: [
    // Keys for Keygrip <https://github.com/crypto-utils/keygrip>, used by signed cookie keys, etc
    "Retruco-API not very secret key, to override",
  ],
  languages: [
    "bg",
    "hr",
    "cs",
    "da",
    "nl",
    "en",
    "et",
    "fi",
    "fr",
    "de",
    "el",
    "hu",
    "ga",
    "it",
    "lv",
    "lt",
    "mt",
    "pl",
    "pt",
    "ro",
    "sk",
    "sl",
    "es",
    "sv"
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
  port: 3000,
  proxy: false,  // Is this application used behind a trusted proxy?
  smtp: {
    host: "localhost",
    port: 25,
    secure: false,  // Use startTLS
    // auth: {
    //   user: "username",
    //   pass: "password",
    // },
    tls: {
        rejectUnauthorized: false,  // Accept self-signed certificates.
    },
  },
  title: "Retruco-API",
  uploads: path.normalize(path.join(__dirname, "..", "uploads"))
};
