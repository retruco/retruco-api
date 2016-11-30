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
  // Basic schemas

  // /types/object is created manually because it references itself.
  // {
  //   symbol: "/types/object",
  //   schemaSymbol: "/types/object",
  //   value: {type: "object"},
  //   widgetSymbol: null,
  // },
  {
    symbol: "/types/boolean",
    schemaSymbol: "/types/object",
    value: {type: "boolean"},
    widgetSymbol: null,
  },
  {
    symbol: "/types/email",
    schemaSymbol: "/types/object",
    value: {type: "string", format: "email"},
    widgetSymbol: null,
  },
  {
    symbol: "/types/number",
    schemaSymbol: "/types/object",
    value: {type: "number"},
    widgetSymbol: null,
  },
  {
    symbol: "/types/string",
    schemaSymbol: "/types/object",
    value: {type: "string"},
    widgetSymbol: null,
  },
  {
    symbol: "/types/uri",
    schemaSymbol: "/types/object",
    value: {type: "string", format: "uri"},
    widgetSymbol: null,
  },

  // Schemas

  // {
  //   symbol: "/schemas/bijective-uri-reference",
  //   schemaSymbol: "/types/object",
  //   value: clean(schemaByPath["/schemas/bijective-uri-reference"]),
  //   widgetSymbol: null,
  // },
  {
    symbol: "/schemas/bijective-uri-reference",
    schemaSymbol: "/types/object",
    value: {
      $ref: "/schemas/bijective-uri-reference",
    },
    widgetSymbol: null,
  },
  {
    symbol: "/schemas/bijective-uri-references-array",
    schemaSymbol: "/types/object",
    value: {
      type: "array",
      items: {
        $ref: "/schemas/bijective-uri-reference",
      },
    },
    widgetSymbol: null,
  },
  // {
  //   symbol: "/schemas/localized-string",
  //   schemaSymbol: "/types/object",
  //   value: clean(schemaByPath["/schemas/localized-string"]),
  //   widgetSymbol: null,
  // },
  {
    symbol: "/schemas/localized-string",
    schemaSymbol: "/types/object",
    value: {
      $ref: "/schemas/localized-string",
    },
    widgetSymbol: null,
  },
  {
    symbol: "/schemas/localized-strings-array",
    schemaSymbol: "/types/object",
    value: {
      type: "array",
      items: {
        $ref: "/schemas/localized-string",
      },
    },
    widgetSymbol: null,
  },
  // {
  //   symbol: "/schemas/uri-reference",
  //   schemaSymbol: "/types/object",
  //   value: clean(schemaByPath["/schemas/uri-reference"]),
  //   widgetSymbol: null,
  // },
  {
    symbol: "/schemas/uri-reference",
    schemaSymbol: "/types/object",
    value: {
      $ref: "/schemas/uri-reference",
    },
    widgetSymbol: null,
  },
  {
    symbol: "/schemas/uri-references-array",
    schemaSymbol: "/types/object",
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
    symbol: "/widgets/autocomplete",
    schemaSymbol: "/types/object",
    value: {
      tag: "Autocomplete",
    },
    widgetSymbol: null,
  },
  {
    symbol: "/widgets/image",
    schemaSymbol: "/types/object",
    value: {
      tag: "Image",
    },
    widgetSymbol: null,
  },
  {
    symbol: "/widgets/input-checkbox",
    schemaSymbol: "/types/object",
    value: {
      tag: "input",
      type: "checkbox",
    },
    widgetSymbol: null,
  },
  {
    symbol: "/widgets/input-email",
    schemaSymbol: "/types/object",
    value: {
      tag: "input",
      type: "email",
    },
    widgetSymbol: null,
  },
  {
    symbol: "/widgets/input-number",
    schemaSymbol: "/types/object",
    value: {
      tag: "input",
      type: "number",
    },
    widgetSymbol: null,
  },
  {
    symbol: "/widgets/input-text",
    schemaSymbol: "/types/object",
    value: {
      tag: "input",
      type: "text",
    },
    widgetSymbol: null,
  },
  {
    symbol: "/widgets/input-url",
    schemaSymbol: "/types/object",
    value: {
      tag: "input",
      type: "url",
    },
    widgetSymbol: null,
  },
  {
    symbol: "/widgets/rated-item-or-set",
    schemaSymbol: "/types/object",
    value: {
      tag: "RatedItemOrSet",
    },
    widgetSymbol: null,
  },
  {
    symbol: "/widgets/textarea",
    schemaSymbol: "/types/object",
    value: {
      tag: "textarea",
    },
    widgetSymbol: null,
  },

  // Keys of properties

  { // localization.en must be first value of type "/schemas/localized-string".
    symbol: "localization.en",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "English Localization",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/types/string", ["/widgets/input-text", "/widgets/textarea"]],
    ],
  },
  {
    symbol: "cons",  // pros & cons
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Cons",  // Against
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/schemas/localized-strings-array", ["/widgets/rated-item-or-set"]],
    ],
  },
  {
    symbol: "description",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Description",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/schemas/localized-string", ["/widgets/textarea", "/widgets/input-text"]],
    ],
  },
  {
    symbol: "license",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "License",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/schemas/localized-string", ["/widgets/input-text", "/widgets/textarea"]],
    ],
  },
  {
    symbol: "localization.es",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Spanish Localization",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/types/string", ["/widgets/input-text", "/widgets/textarea"]],
    ],
  },
  {
    symbol: "localization.fr",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "French Localization",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/types/string", ["/widgets/input-text", "/widgets/textarea"]],
    ],
  },
  {
    symbol: "logo",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Logo",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/types/uri", ["/widgets/image", "/widgets/input-url"]],
    ],
  },
  {
    symbol: "name",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Name",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/schemas/localized-string", ["/widgets/input-text", "/widgets/textarea"]],
    ],
  },
  {
    symbol: "pros",  // pros & cons
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Pros",  // For
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/schemas/localized-strings-array", ["/widgets/rated-item-or-set"]],
    ],
  },
  {
    symbol: "screenshot",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Screenshot",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/types/uri", ["/widgets/image", "/widgets/input-url"]],
    ],
  },
  {
    symbol: "tags",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Tags",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/schemas/localized-strings-array", ["/widgets/rated-item-or-set"]],
    ],
  },
  {
    symbol: "title",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Title",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/schemas/localized-string", ["/widgets/input-text", "/widgets/textarea"]],
    ],
  },
  {
    symbol: "twitter-name",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Twitter Name",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/types/string", ["/widgets/input-text"]],
    ],
  },
  {
    symbol: "types",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Types",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/schemas/localized-strings-array", ["/widgets/rated-item-or-set"]],
    ],
  },
  {
    symbol: "used-by",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Used by",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/schemas/bijective-uri-references-array", ["/widgets/autocomplete"]],
    ],
  },
  {
    symbol: "used-for",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Used for",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/schemas/bijective-uri-references-array", ["/widgets/autocomplete"]],
    ],
  },
  {
    symbol: "website",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Website",
    },
    widgetSymbol: "/widgets/input-text",
    schemasWidgetsOrder: [
      ["/types/uri", ["/widgets/input-url"]],
    ],
  },

  // OGP Toolbox specific types

  {
    symbol: "Platform",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Platform",
    },
    widgetSymbol: "/widgets/input-text",
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
    symbol: "Software",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Software",
    },
    widgetSymbol: "/widgets/input-text",
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
    symbol: "Organization",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Organization",
    },
    widgetSymbol: "/widgets/input-text",
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
    symbol: "UseCase",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Use Case",
    },
    widgetSymbol: "/widgets/input-text",
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
  "/types/object",
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
