/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";
import * as tseslint from "typescript-eslint";


export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  jsdoc.configs["flat/recommended-typescript"],
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
        "warn",
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
        "warn",
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
      ],
      "jsdoc/check-tag-names": [
        "warn",
        {
          definedTags: ["openapi"],
        }
      ],
      "jsdoc/require-jsdoc": ["warn", {
        "require": {
          "FunctionDeclaration": true,
          "MethodDefinition": true,
          "ClassDeclaration": false,
          "ArrowFunctionExpression": false,
          "FunctionExpression": false
        }
      }],
      "jsdoc/require-throws": "warn"
    },
    
  },
  {
    ignores: ["production/*", "node_modules/*"]
  }
);