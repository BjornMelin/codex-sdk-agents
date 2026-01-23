import tsParser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";
import jsdocPlugin from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";

const allowedTags = [
  "ai",
  "codex",
  "openai",
  "remarks",
  "param",
  "typeParam",
  "returns",
  "throws",
  "example",
  "see",
  "deprecated",
];

export default defineConfig([
  globalIgnores([
    "node_modules/**",
    "dist/**",
    "build/**",
    ".turbo/**",
    "opensrc/**",
    "packages/codex-app-server-protocol/src/generated/**",
    "tools/codex-schemas/**",
    "tools/.trash/**",
  ]),
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: { jsdoc: jsdocPlugin, tsdoc },
    rules: {
      "tsdoc/syntax": "error",
      "jsdoc/check-tag-names": ["error", { definedTags: allowedTags }],
      "jsdoc/sort-tags": ["error", { tagSequence: [{ tags: allowedTags }] }],
      "jsdoc/require-hyphen-before-param-description": "error",
    },
  },
]);
