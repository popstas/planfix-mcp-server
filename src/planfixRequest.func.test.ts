import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const cacheMap = new Map<string, any>();
const getMock = vi.fn(async (key: string) => cacheMap.get(key));
const setMock = vi.fn(async (key: string, value: any) => {
  cacheMap.set(key, value);
});
const getCacheProvider = vi.fn(() => ({ get: getMock, set: setMock }));

vi.mock("./lib/cache.js", () => ({ getCacheProvider }));

// Mock customFieldsConfig to return empty proxyUrl by default
vi.mock("./customFieldsConfig.js", async () => {
  const actual = await vi.importActual("./customFieldsConfig.js");
  return {
    ...actual,
    proxyUrl: "",
  };
});

const createFetchMock = (response: any) =>
  vi.fn().mockResolvedValue({
    ok: response.ok !== false,
    status: response.status ?? 200,
    json: async () => response.body,
  });

beforeEach(() => {
  cacheMap.clear();
  getMock.mockClear();
  setMock.mockClear();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PLANFIX_CONFIG;
  try {
    vi.doUnmock("undici");
  } catch (error) {
    // ignore when module wasn't mocked
    if (error instanceof Error && !/is not mocked/.test(error.message)) {
      throw error;
    }
  }
});

describe("planfixRequest", () => {
  it("sends GET request with query params", async () => {
    process.env.PLANFIX_ACCOUNT = "acc";
    process.env.PLANFIX_TOKEN = "tok";
    const fetchMock = createFetchMock({ body: { ok: true } });
    vi.stubGlobal("fetch", fetchMock);

    const { planfixRequest } = await import("./helpers.js");
    const { PLANFIX_BASE_URL, PLANFIX_HEADERS } = await import("./config.js");

    const result = await planfixRequest({
      path: "task/list",
      method: "GET",
      body: { a: 1 },
    });

    expect(fetchMock).toHaveBeenCalledWith(`${PLANFIX_BASE_URL}task/list?a=1`, {
      method: "GET",
      headers: PLANFIX_HEADERS,
      body: undefined,
    });
    expect(result).toEqual({ ok: true });
  });

  it("throws error for non-ok response", async () => {
    process.env.PLANFIX_ACCOUNT = "acc";
    process.env.PLANFIX_TOKEN = "tok";
    const fetchMock = createFetchMock({
      ok: false,
      status: 400,
      body: { error: "bad" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { planfixRequest } = await import("./helpers.js");

    await expect(planfixRequest({ path: "x" })).rejects.toThrow("bad");
  });

  it("uses cache when cacheTime is set", async () => {
    process.env.PLANFIX_ACCOUNT = "acc";
    process.env.PLANFIX_TOKEN = "tok";
    const fetchMock = createFetchMock({ body: { ok: true } });
    vi.stubGlobal("fetch", fetchMock);

    const { planfixRequest } = await import("./helpers.js");

    const first = await planfixRequest({ path: "cached", cacheTime: 60 });
    const second = await planfixRequest({ path: "cached", cacheTime: 60 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(getMock).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalled();
  });

  it("uses proxy dispatcher when proxyUrl is configured", async () => {
    process.env.PLANFIX_ACCOUNT = "acc";
    process.env.PLANFIX_TOKEN = "tok";
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "pf-proxy-"));
    const configPath = path.join(configDir, "config.yml");
    fs.writeFileSync(configPath, "proxyUrl: http://localhost:8080");
    process.env.PLANFIX_CONFIG = configPath;

    const proxyAgentInstance = {};
    const ProxyAgent = vi.fn().mockReturnValue(proxyAgentInstance);
    vi.doMock("undici", () => ({ ProxyAgent }));
    
    // Override the customFieldsConfig mock to load from the config file
    vi.doMock("./customFieldsConfig.js", async () => {
      const actual = await vi.importActual("./customFieldsConfig.js");
      return actual;
    });

    const fetchMock = createFetchMock({ body: { ok: true } });
    vi.stubGlobal("fetch", fetchMock);

    const { planfixRequest } = await import("./helpers.js");
    const { PLANFIX_BASE_URL, PLANFIX_HEADERS } = await import("./config.js");

    await planfixRequest({ path: "task/list" });

    expect(ProxyAgent).toHaveBeenCalledWith("http://localhost:8080");
    expect(fetchMock).toHaveBeenCalledWith(`${PLANFIX_BASE_URL}task/list`, {
      method: "POST",
      headers: PLANFIX_HEADERS,
      body: undefined,
      dispatcher: proxyAgentInstance,
    });
  });
});
