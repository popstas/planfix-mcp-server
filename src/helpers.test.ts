import fs from "fs";
import path from "path";
import { z } from "zod";
import {
  afterEach,
  beforeEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

let helpers: typeof import("./helpers.js");
let getTaskUrl: typeof import("./helpers.js").getTaskUrl;
let getCommentUrl: typeof import("./helpers.js").getCommentUrl;
let getContactUrl: typeof import("./helpers.js").getContactUrl;
let getUserUrl: typeof import("./helpers.js").getUserUrl;
let debugLog: typeof import("./helpers.js").debugLog;
let withCache: typeof import("./helpers.js").withCache;
let log: typeof import("./helpers.js").log;
let getToolWithHandler: typeof import("./helpers.js").getToolWithHandler;

beforeAll(async () => {
  process.env.PLANFIX_ACCOUNT = "example";
  helpers = await import("./helpers.js");
  ({
    getTaskUrl,
    getCommentUrl,
    getContactUrl,
    getUserUrl,
    debugLog,
    withCache,
    log,
    getToolWithHandler,
  } = helpers);
});

const cacheDir = path.join(__dirname, "..", "data", "cache");
const cacheFile = path.join(cacheDir, "test.json");

beforeEach(() => {
  if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile);
});

afterEach(() => {
  if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile);
  vi.restoreAllMocks();
  delete process.env.LOG_LEVEL;
  process.env.PLANFIX_ACCOUNT = "example";
});

describe("url helpers", () => {
  beforeEach(() => {
    process.env.PLANFIX_ACCOUNT = "example";
  });

  it("builds task url", () => {
    expect(getTaskUrl(1)).toBe("https://example.planfix.com/task/1");
    expect(getTaskUrl()).toBe("");
  });

  it("builds comment url", () => {
    expect(getCommentUrl(2, 3)).toBe(
      "https://example.planfix.com/task/2?comment=3",
    );
    expect(getCommentUrl()).toBe("");
  });

  it("builds contact url", () => {
    expect(getContactUrl(4)).toBe("https://example.planfix.com/contact/4");
    expect(getContactUrl()).toBe("");
  });

  it("builds user url", () => {
    expect(getUserUrl(5)).toBe("https://example.planfix.com/user/5");
    expect(getUserUrl()).toBe("");
  });
});

describe("debugLog", () => {
  it("logs message when LOG_LEVEL=debug", () => {
    const appendSpy = vi
      .spyOn(fs, "appendFileSync")
      .mockImplementation(() => {});
    process.env.LOG_LEVEL = "debug";
    debugLog("msg");
    expect(appendSpy).toHaveBeenCalled();
  });

  it("does not log when LOG_LEVEL is not debug", () => {
    const appendSpy = vi
      .spyOn(fs, "appendFileSync")
      .mockImplementation(() => {});
    process.env.LOG_LEVEL = "info";
    debugLog("msg");
    expect(appendSpy).not.toHaveBeenCalled();
  });
});

describe("withCache", () => {
  it("stores and retrieves cached value", async () => {
    const fn1 = vi.fn().mockResolvedValue("one");
    const res1 = await withCache("test", fn1, 100);
    expect(res1).toBe("one");
    expect(fn1).toHaveBeenCalledTimes(1);

    const fn2 = vi.fn().mockResolvedValue("two");
    const res2 = await withCache("test", fn2, 100);
    expect(res2).toBe("one");
    expect(fn2).not.toHaveBeenCalled();
  });
});

describe("isValidToolResponse", () => {
  let isValidToolResponse: typeof import("./helpers.js").isValidToolResponse;

  beforeAll(async () => {
    ({ isValidToolResponse } = await import("./helpers.js"));
  });

  it("returns true for a valid response", () => {
    const parsed = { content: [{ text: "{}" }], structuredContent: {} };
    expect(isValidToolResponse(parsed)).toBe(true);
  });

  it("returns false for an invalid response", () => {
    const parsed = { foo: "bar" } as any;
    expect(isValidToolResponse(parsed)).toBe(false);
  });
});

describe("log", () => {
  it("creates directory when missing and writes log", () => {
    const existsSpy = vi
      .spyOn(fs, "existsSync")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    const mkdirSpy = vi
      .spyOn(fs, "mkdirSync")
      .mockReturnValue(undefined as unknown as string | undefined);
    const appendSpy = vi
      .spyOn(fs, "appendFileSync")
      .mockImplementation(() => {});

    log("test message");
    expect(mkdirSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    existsSpy.mockRestore();
  });
});

describe("getToolWithHandler and runTool", () => {
  it("returns tool and parses response", async () => {
    const handlerFn = vi.fn(async (args: { x: number }) => ({
      out: args.x * 2,
    }));
    const tool = getToolWithHandler({
      name: "double",
      description: "desc",
      inputSchema: z.object({ x: z.number() }),
      outputSchema: z.object({ out: z.number() }),
      handler: handlerFn,
    });

    expect(tool.name).toBe("double");
    // ensure json schema conversion keeps property name
    expect((tool.inputSchema as any).properties).toHaveProperty("x");
    const res = (await tool.handler({ x: 2 })) as { out: number };
    expect(res.out).toBe(4);

    const result = (await tool.handler({ x: 3 })) as { out: number };
    expect(result.out).toBe(6);
  });
});
