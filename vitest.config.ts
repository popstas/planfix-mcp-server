import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30000, // Increased from 10s to 30s for API calls
    hookTimeout: 30000, // Also increase hook timeout
    maxConcurrency: 4, // Limit concurrency to prevent API rate limiting
    globals: true, // Enable global test APIs
    exclude: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    coverage: {
      enabled: true,
      exclude: [
        "data/**",
        "zapier-scripts/**",
        ...coverageConfigDefaults.exclude,
      ],
      reporter: ["text", "text-summary", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      clean: true,
    },
  },
});
