import js from "@eslint/js"
import jsxA11y from "eslint-plugin-jsx-a11y"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"
import tseslint from "typescript-eslint"
import local from "./eslint-rules/index.js"

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "src/routeTree.gen.ts",
      "src/api/schema.gen.ts",
      "public/mockServiceWorker.js",
      "playwright-report",
      "test-results",
      "e2e/fixtures/test-client/dist",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y, local },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/incompatible-library": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "jsx-a11y/no-autofocus": "off",
      "local/no-location-assign": "error",
      "local/no-dangerously-set-inner-html": "error",
    },
  },
  {
    files: ["e2e/**", "scripts/**", "eslint-rules/**", "*.config.*", "vitest.setup.ts"],
    rules: { "local/no-location-assign": "off", "no-console": "off" },
  },
  {
    files: ["eslint-rules/**/*.js"],
    languageOptions: { globals: globals.node },
  },
)
