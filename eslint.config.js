/* eslint-disable */

const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const importPlugin = require("eslint-plugin-import");
const stylistic = require("@stylistic/eslint-plugin");
const globals = require("globals");


module.exports = tseslint.config(
  eslint.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname
      },
      globals: {
        ...globals.node
      }
    },
    
  },

  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      import: importPlugin,
      stylistic,
    },
    rules: {
      indent: [
        "error",
        2
      ],
      "linebreak-style": 0,
      quotes: [
        "error",
        "double"
      ],
      semi: [
        "error",
        "always"
      ],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unused-vars": [
        "error", { argsIgnorePattern: "^_" }
      ],
      "no-empty": [2, { allowEmptyCatch: true }],
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false
        }
      ],
      "import/order": [
        "error",
        {
          alphabetize: {
            caseInsensitive: true,
            order: "asc",
          },
          groups: ["external", "builtin", "parent", ["sibling", "index"]],
          "newlines-between": "always",
          pathGroups: [
            {
              group: "external",
              pattern: "react",
              position: "before",
            },
            {
              group: "external",
              pattern: "@my_org/**",
              position: "after",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
        },
      ],
      "stylistic/max-len": [
        "error", 
        { 
          ignoreTemplateLiterals: true, 
          code: 100, 
          ignoreComments: true, 
          ignoreStrings: true 
        }
      ],
      "stylistic/object-curly-spacing": [
        "error",
        "always"
      ],
      "@typescript-eslint/unbound-method": [
        "error",
        {
          ignoreStatic: true
        }
      ]
    },
  },

  {
    ignores: ["production/*"]
  }
);