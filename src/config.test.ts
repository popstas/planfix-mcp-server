import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// config.ts reads env vars and resolves URLs at module-load time, so each case
// resets the module registry and re-imports with a fresh environment.
describe("config base URL resolution", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.PLANFIX_BASE_URL;
    delete process.env.PLANFIX_ACCOUNT_URL;
    process.env.PLANFIX_ACCOUNT = "example";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("defaults to the .com TLD when no override is set", async () => {
    const cfg = await import("./config.js");
    expect(cfg.PLANFIX_BASE_URL).toBe("https://example.planfix.com/rest/");
    expect(cfg.PLANFIX_ACCOUNT_URL).toBe("https://example.planfix.com");
  });

  it("honours PLANFIX_BASE_URL override for .ru accounts", async () => {
    process.env.PLANFIX_BASE_URL = "https://example.planfix.ru/rest/";
    const cfg = await import("./config.js");
    expect(cfg.PLANFIX_BASE_URL).toBe("https://example.planfix.ru/rest/");
    // Web origin is derived from the override (trailing "/rest/" stripped).
    expect(cfg.PLANFIX_ACCOUNT_URL).toBe("https://example.planfix.ru");
  });

  it("allows an explicit PLANFIX_ACCOUNT_URL for the web origin", async () => {
    process.env.PLANFIX_BASE_URL = "https://example.planfix.ru/rest/";
    process.env.PLANFIX_ACCOUNT_URL = "https://custom.example.com";
    const cfg = await import("./config.js");
    expect(cfg.PLANFIX_ACCOUNT_URL).toBe("https://custom.example.com");
  });
});
