module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true
  },
  ignorePatterns: ["temp.*"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript"
  ],
  overrides: [
    {
      env: {
        node: true
      },
      files: [
        ".eslintrc.{js,cjs}"
      ],
      parserOptions: {
        sourceType: "script"
      }
    }
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    project: ["tsconfig(.*)?.json"]
  },
  plugins: [
    "@typescript-eslint",
    "@stylistic"
  ],
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
        "newlines-between": "never",
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
        code: 80, 
        ignoreComments: true, 
        ignoreStrings: true 
      }
    ]
  }
};
