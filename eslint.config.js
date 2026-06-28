import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // Global ignores: compiled output (dist/, gitignored) and legacy standalone
  // scripts (Zapier code-step snippets / data fixtures) are not part of the
  // TypeScript source that lint targets.
  {
    ignores: ["dist/**", "data/**", "zapier-scripts/**", "node_modules/**"],
  },

  // Base ESLint recommended config
  js.configs.recommended,

  // TypeScript recommended config
  ...tseslint.configs.recommended,

  // Project-specific config for source files
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn"
    }
  },

  // Config for test files
  {
    files: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    languageOptions: {
      globals: {...globals.browser, ...globals.node, ...globals.jest},
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: "."
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-function-type": "off"
    }
  }
];
