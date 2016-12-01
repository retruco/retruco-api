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


// import {schemaByPath} from "./schemas"


export const idBySymbol = {}

export const symbolizedTypedValues = [
  // Basic schemas (aka types)

  // schema:object is created manually because it references itself.
  // {
  //   symbol: "schema:object",
  //   schemaSymbol: "schema:object",
  //   value: {type: "object"},
  //   widgetSymbol: null,
  // },
  {
    symbol: "schema:boolean",
    schemaSymbol: "schema:object",
    value: {type: "boolean"},
    widgetSymbol: null,
  },
  {
    symbol: "schema:email",
    schemaSymbol: "schema:object",
    value: {type: "string", format: "email"},
    widgetSymbol: null,
  },
  {
    symbol: "schema:number",
    schemaSymbol: "schema:object",
    value: {type: "number"},
    widgetSymbol: null,
  },
  {
    symbol: "schema:string",
    schemaSymbol: "schema:object",
    value: {type: "string"},
    widgetSymbol: null,
  },
  {
    symbol: "schema:uri",
    schemaSymbol: "schema:object",
    value: {type: "string", format: "uri"},
    widgetSymbol: null,
  },

  // More complex Schemas

  // {
  //   symbol: "schema:bijective-uri-reference",
  //   schemaSymbol: "schema:object",
  //   value: clean(schemaByPath["/schemas/bijective-uri-reference"]),
  //   widgetSymbol: null,
  // },
  {
    symbol: "schema:bijective-uri-reference",
    schemaSymbol: "schema:object",
    value: {
      $ref: "/schemas/bijective-uri-reference",
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:bijective-uri-references-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: {
        $ref: "/schemas/bijective-uri-reference",
      },
    },
    widgetSymbol: null,
  },
  // {
  //   symbol: "schema:localized-string",
  //   schemaSymbol: "schema:object",
  //   value: clean(schemaByPath["/schemas/localized-string"]),
  //   widgetSymbol: null,
  // },
  {
    symbol: "schema:localized-string",
    schemaSymbol: "schema:object",
    value: {
      $ref: "/schemas/localized-string",
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:localized-strings-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: {
        $ref: "/schemas/localized-string",
      },
    },
    widgetSymbol: null,
  },
  // {
  //   symbol: "schema:uri-reference",
  //   schemaSymbol: "schema:object",
  //   value: clean(schemaByPath["/schemas/uri-reference"]),
  //   widgetSymbol: null,
  // },
  {
    symbol: "schema:uri-reference",
    schemaSymbol: "schema:object",
    value: {
      $ref: "/schemas/uri-reference",
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:uri-references-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: {
        $ref: "/schemas/uri-reference",
      },
    },
    widgetSymbol: null,
  },

  // Widgets

  {
    symbol: "widget:autocomplete",
    schemaSymbol: "schema:object",
    value: {
      tag: "Autocomplete",
    },
    widgetSymbol: null,
  },
  {
    symbol: "widget:image",
    schemaSymbol: "schema:object",
    value: {
      tag: "Image",
    },
    widgetSymbol: null,
  },
  {
    symbol: "widget:input-checkbox",
    schemaSymbol: "schema:object",
    value: {
      tag: "input",
      type: "checkbox",
    },
    widgetSymbol: null,
  },
  {
    symbol: "widget:input-email",
    schemaSymbol: "schema:object",
    value: {
      tag: "input",
      type: "email",
    },
    widgetSymbol: null,
  },
  {
    symbol: "widget:input-number",
    schemaSymbol: "schema:object",
    value: {
      tag: "input",
      type: "number",
    },
    widgetSymbol: null,
  },
  {
    symbol: "widget:input-text",
    schemaSymbol: "schema:object",
    value: {
      tag: "input",
      type: "text",
    },
    widgetSymbol: null,
  },
  {
    symbol: "widget:input-url",
    schemaSymbol: "schema:object",
    value: {
      tag: "input",
      type: "url",
    },
    widgetSymbol: null,
  },
  {
    symbol: "widget:rated-item-or-set",
    schemaSymbol: "schema:object",
    value: {
      tag: "RatedItemOrSet",
    },
    widgetSymbol: null,
  },
  {
    symbol: "widget:textarea",
    schemaSymbol: "schema:object",
    value: {
      tag: "textarea",
    },
    widgetSymbol: null,
  },

  // Keys of properties

  { // localization.en must be first value of type "schema:localized-string".
    symbol: "localization.en",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "English Localization",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:string", ["widget:input-text", "widget:textarea"]],
    ],
  },
  {
    symbol: "cons",  // pros & cons
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Cons",  // Against
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:localized-strings-array", ["widget:rated-item-or-set"]],
    ],
  },
  {
    symbol: "description",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Description",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:localized-string", ["widget:textarea", "widget:input-text"]],
    ],
  },
  {
    symbol: "license",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "License",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:localized-string", ["widget:input-text", "widget:textarea"]],
    ],
  },
  {
    symbol: "localization.es",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Spanish Localization",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:string", ["widget:input-text", "widget:textarea"]],
    ],
  },
  {
    symbol: "localization.fr",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "French Localization",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:string", ["widget:input-text", "widget:textarea"]],
    ],
  },
  {
    symbol: "logo",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Logo",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:uri", ["widget:image", "widget:input-url"]],
    ],
  },
  {
    symbol: "name",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Name",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:localized-string", ["widget:input-text", "widget:textarea"]],
    ],
  },
  {
    symbol: "pros",  // pros & cons
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Pros",  // For
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:localized-strings-array", ["widget:rated-item-or-set"]],
    ],
  },
  {
    symbol: "screenshot",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Screenshot",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:uri", ["widget:image", "widget:input-url"]],
    ],
  },
  {
    symbol: "tags",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Tags",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:localized-strings-array", ["widget:rated-item-or-set"]],
    ],
  },
  {
    symbol: "title",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Title",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:localized-string", ["widget:input-text", "widget:textarea"]],
    ],
  },
  {
    symbol: "twitter-name",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Twitter Name",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:string", ["widget:input-text"]],
    ],
  },
  {
    symbol: "types",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Types",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:localized-strings-array", ["widget:rated-item-or-set"]],
    ],
  },
  {
    symbol: "used-by",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Used by",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:bijective-uri-references-array", ["widget:autocomplete"]],
    ],
  },
  {
    symbol: "used-for",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Used for",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:bijective-uri-references-array", ["widget:autocomplete"]],
    ],
  },
  {
    symbol: "website",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Website",
    },
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [
      ["schema:uri", ["widget:input-url"]],
    ],
  },

  // OGP Toolbox specific types

  {
    symbol: "type:platform",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Platform",
    },
    widgetSymbol: "widget:input-text",
    keysOrder: [
      "types",
      "name",
      "description",
      "logo",
      "screenshot",
      "tags",
    ],
  },
  {
    symbol: "type:software",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Software",
    },
    widgetSymbol: "widget:input-text",
    keysOrder: [
      "types",
      "name",
      "description",
      "license",
      "logo",
      "screenshot",
      "tags",
    ],
  },
  {
    symbol: "type:organization",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Organization",
    },
    widgetSymbol: "widget:input-text",
    keysOrder: [
      "types",
      "name",
      "description",
      "logo",
      "screenshot",
      "tags",
    ],
  },
  {
    symbol: "type:use-case",
    schemaSymbol: "schema:localized-string",
    value: {
      en: "Use Case",
    },
    widgetSymbol: "widget:input-text",
    keysOrder: [
      "types",
      "name",
      "description",
      "logo",
      "screenshot",
      "tags",
    ],
  },
]

export const symbols = [
  "schema:object",
  ...symbolizedTypedValues.map(infos => infos.symbol),
]

export const symbolById = {}

const valueValueBySymbol = symbolizedTypedValues.reduce((d, typedValue) => {
  d[typedValue.symbol] = typedValue.value
  return d
}, {})


// function clean(object) {
//   // Clean up a schema or widget
//   let clone = Object.assign({}, object)
//   delete clone.description
//   delete clone.title
//   return clone
// }


export function getIdFromSymbol(symbol) {
  if (symbol === null) return null
  let valueId = idBySymbol[symbol]
  if (valueId === undefined) throw `Unknown symbol for getIdFromSymbol: ${symbol}`
  return valueId
}


export function getSymbolOrId(id) {
  if (id === null) return null
  return symbolById[id] || id
}

export function getValueValueFromSymbol(symbol) {
  if (symbol === null) return null
  let value = valueValueBySymbol[symbol]
  if (value === undefined) throw `Unknown symbol for getValueValueFromSymbol: ${symbol}`
  return value
}
