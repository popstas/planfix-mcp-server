import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/planfixDirectory.js", () => ({
  searchDirectory: vi.fn(),
  searchDirectoryEntryById: vi.fn(),
  searchAllDirectoryEntries: vi.fn(),
  getDirectoryFields: vi.fn(),
}));

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return { ...actual, log: vi.fn() };
});

import {
  searchDirectory,
  searchDirectoryEntryById,
  searchAllDirectoryEntries,
  getDirectoryFields,
} from "../lib/planfixDirectory.js";
import planfixSearchDirectoryEntryTool, {
  planfixSearchDirectoryEntry,
} from "./planfix_search_directory_entry.js";

const mDir = vi.mocked(searchDirectory);
const mEntryById = vi.mocked(searchDirectoryEntryById);
const mAll = vi.mocked(searchAllDirectoryEntries);
const mFields = vi.mocked(getDirectoryFields);

describe("planfixSearchDirectoryEntry", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns entry id from exact search", async () => {
    mDir.mockResolvedValueOnce({ id: 1, name: "Dir" });
    mFields.mockResolvedValueOnce([{ id: 11, name: "", type: 0 }]);
    mEntryById.mockResolvedValueOnce(5);
    const res = await planfixSearchDirectoryEntry({
      directory: "Dir",
      entry: "E",
    });
    expect(res).toEqual({ entryId: 5, found: true });
    expect(mEntryById).toHaveBeenCalledWith(1, 11, "E");
  });

  it("falls back to search all entries", async () => {
    mDir.mockResolvedValueOnce({ id: 1, name: "Dir" });
    mFields.mockResolvedValueOnce([{ id: 11, name: "", type: 0 }]);
    mEntryById.mockResolvedValueOnce(undefined);
    mAll.mockResolvedValueOnce([
      { key: 9, name: "One" },
      { key: 10, name: "Entry" },
    ]);
    const res = await planfixSearchDirectoryEntry({
      directory: "Dir",
      entry: "entry",
    });
    expect(res).toEqual({ entryId: 10, found: true });
  });

  it("returns not found", async () => {
    mDir.mockResolvedValueOnce({ id: 1, name: "Dir" });
    mFields.mockResolvedValueOnce([{ id: 11, name: "", type: 0 }]);
    mEntryById.mockResolvedValueOnce(undefined);
    mAll.mockResolvedValueOnce([]);
    const res = await planfixSearchDirectoryEntry({
      directory: "Dir",
      entry: "none",
    });
    expect(res).toEqual({ entryId: 0, found: false });
  });

  it("handles directory not found", async () => {
    mDir.mockResolvedValueOnce(undefined);
    const res = await planfixSearchDirectoryEntry({
      directory: "Missing",
      entry: "E",
    });
    expect(res.error).toBe("Directory not found");
    expect(res.found).toBe(false);
  });

  it("handles fields missing", async () => {
    mDir.mockResolvedValueOnce({ id: 1, name: "Dir" });
    mFields.mockResolvedValueOnce(undefined as any);
    const res = await planfixSearchDirectoryEntry({
      directory: "Dir",
      entry: "E",
    });
    expect(res.error).toBe("Directory fields not found");
  });

  it("handles errors", async () => {
    mDir.mockRejectedValueOnce(new Error("boom"));
    const res = await planfixSearchDirectoryEntry({
      directory: "Dir",
      entry: "E",
    });
    expect(res.error).toBe("boom");
  });
});

describe("handler", () => {
  it("parses args", async () => {
    mDir.mockResolvedValueOnce({ id: 1, name: "Dir" });
    mFields.mockResolvedValueOnce([{ id: 2, name: "", type: 0 }]);
    mEntryById.mockResolvedValueOnce(7);
    const result = (await planfixSearchDirectoryEntryTool.handler({
      directory: "Dir",
      entry: "En",
    })) as any;
    expect(result.entryId).toBe(7);
    expect(result.found).toBe(true);
  });
});
