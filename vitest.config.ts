import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000, // Increased from 10s to 30s for API calls
    hookTimeout: 30000, // Also increase hook timeout
    maxConcurrency: 4, // Limit concurrency to prevent API rate limiting
    globals: true, // Enable global test APIs
  },
});
