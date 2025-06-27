import fs from "fs";
import path from "path";
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