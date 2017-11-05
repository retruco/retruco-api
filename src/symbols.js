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

// import {schemaByPath} from "./schemas"

export const debateKeySymbols = ["con", "option", "pro", "remark", "source"]
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
    value: { type: "boolean" },
    widgetSymbol: null,
  },
  {
    symbol: "schema:booleans-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: { type: "boolean" },
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:email",
    schemaSymbol: "schema:object",
    value: { type: "string", format: "email" },
    widgetSymbol: null,
  },
  {
    symbol: "schema:emails-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: { type: "string", format: "email" },
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:number",
    schemaSymbol: "schema:object",
    value: { type: "number" },
    widgetSymbol: null,
  },
  {
    symbol: "schema:numbers-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: { type: "number" },
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:string",
    schemaSymbol: "schema:object",
    value: { type: "string" },
    widgetSymbol: null,
  },
  {
    symbol: "schema:strings-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: { type: "string" },
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:uri",
    schemaSymbol: "schema:object",
    value: { type: "string", format: "uri" },
    widgetSymbol: null,
  },
  {
    symbol: "schema:uri-reference",
    schemaSymbol: "schema:object",
    value: { type: "string", format: "uri-reference" },
    widgetSymbol: null,
  },
  {
    symbol: "schema:uri-references-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: { type: "string", format: "uri-reference" },
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:uris-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: { type: "string", format: "uri" },
    },
    widgetSymbol: null,
  },

  // More complex Schemas

  {
    symbol: "schema:bijective-card-reference",
    schemaSymbol: "schema:object",
    value: {
      $ref: "/schemas/bijective-card-reference",
    },
    widgetSymbol: null,
  },
  {
    // Import only symbol. Not used internally.
    symbol: "schema:bijective-card-references-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: {
        $ref: "/schemas/bijective-card-reference",
      },
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:card-id",
    schemaSymbol: "schema:object",
    value: {
      $ref: "/schemas/card-id",
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:card-ids-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: {
        $ref: "/schemas/card-id",
      },
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:id",
    schemaSymbol: "schema:object",
    value: {
      $ref: "/schemas/id",
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:ids-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: {
        $ref: "/schemas/id",
      },
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:localized-string",
    schemaSymbol: "schema:object",
    value: {
      $ref: "/schemas/localized-string",
    },
    widgetSymbol: null,
  },
  {
    // Import only symbol. Not used internally.
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
  {
    symbol: "schema:property-id",
    schemaSymbol: "schema:object",
    value: {
      $ref: "/schemas/property-id",
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:property-ids-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: {
        $ref: "/schemas/property-id",
      },
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:value-id",
    schemaSymbol: "schema:object",
    value: {
      $ref: "/schemas/value-id",
    },
    widgetSymbol: null,
  },
  {
    symbol: "schema:value-ids-array",
    schemaSymbol: "schema:object",
    value: {
      type: "array",
      items: {
        $ref: "/schemas/value-id",
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

  // Values

  {
    symbol: "false",
    schemaSymbol: "schema:boolean",
    value: false,
    widgetSymbol: "widget:input-checkbox",
  },
  {
    symbol: "situation",
    schemaSymbol: "schema:string",
    value: "Situation",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "true",
    schemaSymbol: "schema:boolean",
    value: true,
    widgetSymbol: "widget:input-checkbox",
  },

  // Keys of language properties

  {
    symbol: "en",
    schemaSymbol: "schema:string",
    value: "English Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "bg",
    schemaSymbol: "schema:string",
    value: "Bulgarian Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "cs",
    schemaSymbol: "schema:string",
    value: "Czech Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "da",
    schemaSymbol: "schema:string",
    value: "Danish Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "de",
    schemaSymbol: "schema:string",
    value: "German Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "el",
    schemaSymbol: "schema:string",
    value: "Greek Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "es",
    schemaSymbol: "schema:string",
    value: "Spanish Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "et",
    schemaSymbol: "schema:string",
    value: "Estonian Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "fi",
    schemaSymbol: "schema:string",
    value: "Finnish Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "fr",
    schemaSymbol: "schema:string",
    value: "French Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "ga",
    schemaSymbol: "schema:string",
    value: "Irish Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "hr",
    schemaSymbol: "schema:string",
    value: "Croatian Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "hu",
    schemaSymbol: "schema:string",
    value: "Hungarian Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "it",
    schemaSymbol: "schema:string",
    value: "Italian Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "lv",
    schemaSymbol: "schema:string",
    value: "Latvian Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "lt",
    schemaSymbol: "schema:string",
    value: "Lithuanian Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "mt",
    schemaSymbol: "schema:string",
    value: "Maltese Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "nl",
    schemaSymbol: "schema:string",
    value: "Dutch Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "pl",
    schemaSymbol: "schema:string",
    value: "Ploish Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "pt",
    schemaSymbol: "schema:string",
    value: "Portugues Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "ro",
    schemaSymbol: "schema:string",
    value: "Romanian Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "sk",
    schemaSymbol: "schema:string",
    value: "Slovak Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "sl",
    schemaSymbol: "schema:string",
    value: "Slovenian Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "sv",
    schemaSymbol: "schema:string",
    value: "Swedish Localization",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },

  // Keys of debate properties

  {
    symbol: "con", // pros & cons
    schemaSymbol: "schema:string",
    value: "Con", // Against
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:value-ids-array", ["widget:rated-item-or-set"]]],
  },
  {
    symbol: "pro", // pros & cons
    schemaSymbol: "schema:string",
    value: "Pro", // For
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:value-ids-array", ["widget:rated-item-or-set"]]],
  },
  {
    symbol: "option", // Alternatives for consideration to a question
    schemaSymbol: "schema:string",
    value: "Option",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:value-ids-array", ["widget:rated-item-or-set"]]],
  },
  {
    symbol: "remark",
    schemaSymbol: "schema:string",
    value: "Remark",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:value-ids-array", ["widget:rated-item-or-set"]]],
  },
  {
    symbol: "source", // Sources for an affirmation or an argument.
    schemaSymbol: "schema:string",
    value: "Source",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:value-ids-array", ["widget:rated-item-or-set"]]],
  },

  // Keys of other properties

  {
    symbol: "description",
    schemaSymbol: "schema:string",
    value: "Description",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:textarea", "widget:input-text"]]],
  },
  {
    symbol: "discussion",
    schemaSymbol: "schema:string",
    value: "Discussion",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:id", ["widget:autocomplete"]]],
  },
  {
    symbol: "duplicate-of",
    schemaSymbol: "schema:string",
    value: "Duplicate of",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:id", ["widget:autocomplete"]]],
  },
  {
    symbol: "license",
    schemaSymbol: "schema:string",
    value: "License",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "location",
    schemaSymbol: "schema:string",
    value: "Location",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "logo",
    schemaSymbol: "schema:string",
    value: "Logo",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:uri-reference", ["widget:image", "widget:input-url"]]],
  },
  {
    symbol: "name",
    schemaSymbol: "schema:string",
    value: "Name",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "screenshot",
    schemaSymbol: "schema:string",
    value: "Screenshot",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:uri-reference", ["widget:image", "widget:input-url"]]],
  },
  {
    symbol: "source-code",
    schemaSymbol: "schema:string",
    value: "SourceCode",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:uri", ["widget:input-url"]]],
  },
  {
    symbol: "suggestion",
    schemaSymbol: "schema:string",
    value: "Suggestion",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:id", ["widget:autocomplete"]]],
  },
  {
    symbol: "tags",
    schemaSymbol: "schema:string",
    value: "Tags",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:value-ids-array", ["widget:rated-item-or-set"]]],
  },
  {
    symbol: "title",
    schemaSymbol: "schema:string",
    value: "Title",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text", "widget:textarea"]]],
  },
  {
    symbol: "trashed",
    schemaSymbol: "schema:string",
    value: "Trash",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:boolean", ["widget:input-checkbox"]]],
  },
  {
    symbol: "twitter-name",
    schemaSymbol: "schema:string",
    value: "Twitter Name",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:string", ["widget:input-text"]]],
  },
  {
    symbol: "type",
    schemaSymbol: "schema:string",
    value: "Type",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:value-ids-array", ["widget:rated-item-or-set"]]],
  },
  {
    symbol: "use-cases",
    schemaSymbol: "schema:string",
    value: "Use Cases",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:ids-array", ["widget:autocomplete"]]],
  },
  {
    symbol: "used-by",
    schemaSymbol: "schema:string",
    value: "Used by",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:ids-array", ["widget:autocomplete"]]],
  },
  {
    symbol: "used-for",
    schemaSymbol: "schema:string",
    value: "Used for",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:ids-array", ["widget:autocomplete"]]],
  },
  {
    symbol: "uses",
    schemaSymbol: "schema:string",
    value: "Uses",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:ids-array", ["widget:autocomplete"]]],
  },
  {
    symbol: "website",
    schemaSymbol: "schema:string",
    value: "Website",
    widgetSymbol: "widget:input-text",
    schemasWidgetsOrder: [["schema:uri", ["widget:input-url"]]],
  },

  // OGP Toolbox specific types

  {
    symbol: "platform",
    schemaSymbol: "schema:string",
    value: "Platform",
    widgetSymbol: "widget:input-text",
    keysOrder: ["type", "name", "description", "website", "logo", "screenshot", "tags"],
  },
  {
    symbol: "software",
    schemaSymbol: "schema:string",
    value: "Software",
    widgetSymbol: "widget:input-text",
    keysOrder: ["type", "name", "description", "license", "website", "logo", "screenshot", "tags"],
  },
  {
    symbol: "organization",
    schemaSymbol: "schema:string",
    value: "Organization",
    widgetSymbol: "widget:input-text",
    keysOrder: ["type", "name", "description", "website", "logo", "screenshot", "tags"],
  },
  {
    symbol: "use-case",
    schemaSymbol: "schema:string",
    value: "Use Case",
    widgetSymbol: "widget:input-text",
    keysOrder: ["type", "name", "description", "website", "logo", "screenshot", "tags"],
  },

  // OGP Explorer specific tags

  // Public Integrity Measures
  {
    symbol: "public-integrity-measures",
    schemaSymbol: "schema:string",
    value: "Public Integrity Measures",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "anti-corruption",
    schemaSymbol: "schema:string",
    value: "Anti-corruption",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "conflicts-of-interest",
    schemaSymbol: "schema:string",
    value: "Conflicts of interest",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "asset-disclosure",
    schemaSymbol: "schema:string",
    value: "Asset disclosure",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "audits-control",
    schemaSymbol: "schema:string",
    value: "Audits & control",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "whistleblower-protections",
    schemaSymbol: "schema:string",
    value: "Whistleblower protections",
    widgetSymbol: "widget:input-text",
  },

  // Fiscal Openness
  {
    symbol: "fiscal-openness",
    schemaSymbol: "schema:string",
    value: "Fiscal Openness",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "budget-transparency",
    schemaSymbol: "schema:string",
    value: "Budget Transparency",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "citizen-budgets",
    schemaSymbol: "schema:string",
    value: "Citizen Budgets",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "participatory-budgeting",
    schemaSymbol: "schema:string",
    value: "Participatory budgeting",
    widgetSymbol: "widget:input-text",
  },

  // Citizen Engagement
  {
    symbol: "citizen-engagement",
    schemaSymbol: "schema:string",
    value: "Citizen Engagement",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "e-petitions",
    schemaSymbol: "schema:string",
    value: "E-petitions",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "social-audits",
    schemaSymbol: "schema:string",
    value: "Social Audits",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "public-participation",
    schemaSymbol: "schema:string",
    value: "Public Participation",
    widgetSymbol: "widget:input-text",
  },

  // Procurement
  {
    symbol: "procurement",
    schemaSymbol: "schema:string",
    value: "Procurement",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "public-procurement",
    schemaSymbol: "schema:string",
    value: "Public Procurement",
    widgetSymbol: "widget:input-text",
  },

  // Access to Information Mechanisms
  {
    symbol: "access-to-information-mechanisms",
    schemaSymbol: "schema:string",
    value: "Access to Information Mechanisms",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "records-management",
    schemaSymbol: "schema:string",
    value: "Records Management",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "elections-political-finance",
    schemaSymbol: "schema:string",
    value: "Elections & Political Finance",
    widgetSymbol: "widget:input-text",
  },

  // Justice
  {
    symbol: "justice",
    schemaSymbol: "schema:string",
    value: "Justice",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "law-enforcement-justice",
    schemaSymbol: "schema:string",
    value: "Law Enforcement & Justice",
    widgetSymbol: "widget:input-text",
  },

  // Public Services
  {
    symbol: "public-services",
    schemaSymbol: "schema:string",
    value: "Public Services",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "public-service-delivery-improvement",
    schemaSymbol: "schema:string",
    value: "Public Service Delivery Improvement",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "e-government",
    schemaSymbol: "schema:string",
    value: "E-government",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "open-data",
    schemaSymbol: "schema:string",
    value: "Open data",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "capacity-building",
    schemaSymbol: "schema:string",
    value: "Capacity-building",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "legislative-regulation",
    schemaSymbol: "schema:string",
    value: "Legislative & Regulation",
    widgetSymbol: "widget:input-text",
  },

  // Sectors
  {
    symbol: "sectors",
    schemaSymbol: "schema:string",
    value: "Sectors",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "media-telecommunications",
    schemaSymbol: "schema:string",
    value: "Media & Telecommunications",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "education",
    schemaSymbol: "schema:string",
    value: "Education",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "health-nutrition",
    schemaSymbol: "schema:string",
    value: "Health and Nutrition",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "citizenship-immigration",
    schemaSymbol: "schema:string",
    value: "Citizenship & Immigration",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "welfare-social-security",
    schemaSymbol: "schema:string",
    value: "Welfare & Social Security",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "water-sanitation",
    schemaSymbol: "schema:string",
    value: "Water & Sanitation",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "infrastructure",
    schemaSymbol: "schema:string",
    value: "Infrastructure",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "public-safety",
    schemaSymbol: "schema:string",
    value: "Public safety",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "defense",
    schemaSymbol: "schema:string",
    value: "Defense",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "natural-resources",
    schemaSymbol: "schema:string",
    value: "Natural Resources",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "aid",
    schemaSymbol: "schema:string",
    value: "Aid",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "nonprofits",
    schemaSymbol: "schema:string",
    value: "Nonprofits",
    widgetSymbol: "widget:input-text",
  },

  // Who is Affected
  {
    symbol: "who-is-affected",
    schemaSymbol: "schema:string",
    value: "Who is Affected",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "private-sector",
    schemaSymbol: "schema:string",
    value: "Private sector",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "legislature",
    schemaSymbol: "schema:string",
    value: "Legislature",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "sub-national-governance",
    schemaSymbol: "schema:string",
    value: "Sub-national governance",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "judiciary",
    schemaSymbol: "schema:string",
    value: "Judiciary",
    widgetSymbol: "widget:input-text",
  },

  // Mainstreaming Issues
  {
    symbol: "mainstreaming-issues",
    schemaSymbol: "schema:string",
    value: "Mainstreaming Issues",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "gender-sexuality",
    schemaSymbol: "schema:string",
    value: "Gender & sexuality",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "human-rights",
    schemaSymbol: "schema:string",
    value: "Human rights",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "ogp",
    schemaSymbol: "schema:string",
    value: "OGP",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "marginalised-communities",
    schemaSymbol: "schema:string",
    value: "Marginalised communities",
    widgetSymbol: "widget:input-text",
  },
  {
    symbol: "labor",
    schemaSymbol: "schema:string",
    value: "Labor",
    widgetSymbol: "widget:input-text",
  },
]

export const symbols = ["schema:object", ...symbolizedTypedValues.map(infos => infos.symbol)]

export const symbolById = {}

const valueBySymbol = symbolizedTypedValues.reduce((d, typedValue) => {
  d[typedValue.symbol] = typedValue.value
  return d
}, {})

export function getIdFromIdOrSymbol(idOrSymbol) {
  if (idOrSymbol === null) return null
  if (isNaN(parseInt(idOrSymbol))) return getIdFromSymbol(idOrSymbol)
  return idOrSymbol
}

export function getIdFromSymbol(symbol) {
  if (symbol === null) return null
  let valueId = idBySymbol[symbol]
  if (valueId === undefined) throw `Unknown symbol for getIdFromSymbol: ${symbol}`
  return valueId
}

export function getIdOrSymbolFromId(id) {
  if (id === null) return null
  return symbolById[id] || id
}

export function getValueFromSymbol(symbol) {
  if (symbol === null) return null
  let value = valueBySymbol[symbol]
  if (value === undefined) throw `Unknown symbol for getValueFromSymbol: ${symbol}`
  return value
}
