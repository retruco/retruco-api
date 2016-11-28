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

  // Widgets

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
    symbol: "/widgets/rated-item-or-set",
    schemaSymbol: "/types/object",
    value: {
      tag: "RatedItemOrSet",
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
  },
  {
    symbol: "cons",  // pros & cons
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Cons",  // Against
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "description",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Description",
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "license",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "License",
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "localization.es",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Spanish Localization",
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "localization.fr",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "French Localization",
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "logo",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Logo",
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "name",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Name",
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "pros",  // pros & cons
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Pros",  // For
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "screenshot",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Screenshot",
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "tags",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Tags",
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "title",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Title",
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "twitter-name",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Twitter Name",
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "types",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Types",
    },
    widgetSymbol: "/widgets/input-text",
  },
  {
    symbol: "website",
    schemaSymbol: "/schemas/localized-string",
    value: {
      en: "Website",
    },
    widgetSymbol: "/widgets/input-text",
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
