import { describe, it, vi, expect } from "vitest";
import { cacheClear } from "./cache-clear.js";

const clearMock = vi.fn();
vi.mock("../lib/cache.js", () => ({
  getCacheProvider: () => ({ clear: clearMock }),
}));

describe("cacheClear", () => {
  it("calls cache provider clear", async () => {
    await cacheClear();
    expect(clearMock).toHaveBeenCalled();
  });
});
