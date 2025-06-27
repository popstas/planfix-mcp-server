import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/planfixDirectory.js", () => ({
  searchDirectory: vi.fn(),
}));

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return { ...actual, log: vi.fn() };
});

import { searchDirectory } from "../lib/planfixDirectory.js";
import planfixSearchDirectoryTool, {
  planfixSearchDirectory,
} from "./planfix_search_directory.js";

const mockSearch = vi.mocked(searchDirectory);

describe("planfixSearchDirectory", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns directory when found", async () => {
    mockSearch.mockResolvedValueOnce({ id: 1, name: "Dir" });
    const res = await planfixSearchDirectory({ name: "Dir" });
    expect(res).toEqual({ directoryId: 1, name: "Dir", found: true });
  });

  it("returns not found", async () => {
    mockSearch.mockResolvedValueOnce(undefined);
    const res = await planfixSearchDirectory({ name: "None" });
    expect(res.directoryId).toBe(0);
    expect(res.found).toBe(false);
  });

  it("handles errors", async () => {
    mockSearch.mockRejectedValueOnce(new Error("fail"));
    const res = await planfixSearchDirectory({ name: "Err" });
    expect(res.error).toBe("fail");
    expect(res.found).toBe(false);
  });
});

describe("handler", () => {
  it("parses args", async () => {
    mockSearch.mockResolvedValueOnce({ id: 2, name: "Dir" });
    const result = (await planfixSearchDirectoryTool.handler({
      name: "Dir",
    })) as any;
    expect(result.directoryId).toBe(2);
    expect(mockSearch).toHaveBeenCalled();
  });
});
