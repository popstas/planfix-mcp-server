import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

import fsp from "fs/promises";
import { withCache, isValidToolResponse } from "./helpers.js";

const mockReadFile = vi.mocked(fsp.readFile);
const mockWriteFile = vi.mocked(fsp.writeFile);
const mockMkdir = vi.mocked(fsp.mkdir);

describe("withCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached data if cache is valid", async () => {
    const cached = { data: { value: 1 }, expiresAt: Date.now() + 1000 };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(cached));
    const dataFn = vi.fn();

    const res = await withCache("cache", dataFn);

    expect(res).toEqual(cached.data);
    expect(dataFn).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("generates data and writes cache when missing", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("miss"));
    const dataFn = vi.fn().mockResolvedValue({ ok: true });

    const res = await withCache("new", dataFn, 10);

    expect(dataFn).toHaveBeenCalledTimes(1);
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
    const writeArgs = mockWriteFile.mock.calls[0];
    expect(writeArgs[0]).toContain(path.join("data", "cache", "new.json"));
    const written = JSON.parse(writeArgs[1] as string);
    expect(written.data).toEqual({ ok: true });
    expect(res).toEqual({ ok: true });
  });
});

describe("isValidToolResponse", () => {
  it("validates correct shape", () => {
    const obj = { content: [{ text: "hi" }], structuredContent: {} };
    expect(isValidToolResponse(obj)).toBe(true);
  });

  it("fails for invalid value", () => {
    expect(isValidToolResponse({})).toBe(false);
  });
});
