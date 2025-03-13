/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import * as tseslint from "typescript-eslint";


export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ["**/tsconfig.eslint.json"],
      },
      globals: {
        ...globals.node
      }
    },

  },

  {
    files: ["**/*.ts", "**/*.tsx", "**/*.config.js"],
    plugins: {
      import: importPlugin,
      "@stylistic": stylistic,
    },
    rules: {
      indent: [
        "error",
        2,
        {
          "SwitchCase": 1,
          "ignoredNodes": ["ConditionalExpression", "flatTernaryExpressions "]
        },
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
      "no-unused-vars": "off",
      "no-empty": [2, { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": [
        "error", 
        { 
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
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
      "@stylistic/max-len": [
        "error",
        {
          ignoreTemplateLiterals: true,
          code: 100,
          ignoreComments: true,
          ignoreStrings: true
        }
      ],
      "@stylistic/object-curly-spacing": [
        "error",
        "always"
      ],
      "@typescript-eslint/unbound-method": [
        "error",
        {
          ignoreStatic: true
        }
      ],
      // "@typescript-eslint/explicit-member-accessibility": "error",
      "no-constant-condition": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          "checksVoidReturn": false
        }
      ]
    },
  },
  {
    ignores: ["production/*", "node_modules/*"]
  }
);