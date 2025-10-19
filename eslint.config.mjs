// eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import react from "eslint-plugin-react";
import jsxA11Y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default defineConfig([
  // Ignora pastas desnecessárias
  globalIgnores([
    "node_modules",
    "dist",
    "build",
    ".next",
    "coverage",
    "public",
  ]),

  {
    files: ["**/*.{ts,tsx,js,jsx}"],

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    plugins: {
      react,
      "jsx-a11y": jsxA11Y,
      import: importPlugin,
      "unused-imports": unusedImports,
      "@typescript-eslint": typescriptEslint,
    },

    extends: [
      js.configs.recommended,
      "plugin:@typescript-eslint/recommended",
      "plugin:react/recommended",
      "plugin:react-hooks/recommended",
      "plugin:jsx-a11y/recommended",
    ],

    rules: {
      "no-console": "warn",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-unused-vars": "off",

      // Variáveis e imports não usados
      "@typescript-eslint/no-unused-vars": ["warn"],
      "unused-imports/no-unused-imports": "warn",

      // Organização de imports
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
        },
      ],
    },

    settings: {
      react: {
        version: "detect",
      },
    },
  },
]);