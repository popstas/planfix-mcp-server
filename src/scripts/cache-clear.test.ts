import { describe, it, vi, expect } from "vitest";
let clearObjectsCacheMock: any;
const clearMock = vi.fn();
vi.mock("../lib/cache.js", () => ({
  getCacheProvider: () => ({ clear: clearMock }),
}));
vi.mock("../lib/planfixObjects.js", () => {
  clearObjectsCacheMock = vi.fn();
  return { clearObjectsCache: clearObjectsCacheMock };
});

describe("cacheClear", () => {
  it("clears cache and objects cache file", async () => {
    const { cacheClear } = await import("./cache-clear.js");
    await cacheClear();
    expect(clearMock).toHaveBeenCalled();
    expect(clearObjectsCacheMock).toHaveBeenCalled();
  });
});
