module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "tsdoc", "jsdoc"],
  extends: ["plugin:@typescript-eslint/recommended"],
  rules: {
    "tsdoc/syntax": "warn",
    "jsdoc/check-tag-names": [
      "warn",
      {
        definedTags: [
          "remarks",
          "param",
          "typeParam",
          "returns",
          "throws",
          "example",
          "see",
          "deprecated",
        ],
      },
    ],
    "jsdoc/sort-tags": [
      "warn",
      {
        tagSequence: [
          "remarks",
          "param",
          "typeParam",
          "returns",
          "throws",
          "example",
          "see",
          "deprecated",
        ],
      },
    ],
    "jsdoc/require-hyphen-before-param-description": "warn",
  },
};
