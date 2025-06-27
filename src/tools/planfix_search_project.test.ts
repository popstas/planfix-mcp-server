import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return { ...actual, planfixRequest: vi.fn(), log: vi.fn() };
});

import { planfixRequest } from "../helpers.js";
import {
  searchProject,
  planfixSearchProjectTool,
} from "./planfix_search_project.js";

const mockRequest = vi.mocked(planfixRequest);

describe("searchProject", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns project when found", async () => {
    mockRequest.mockResolvedValueOnce({ projects: [{ id: 5, name: "Proj" }] });
    const res = await searchProject({ name: "Proj" });
    expect(mockRequest).toHaveBeenCalled();
    expect(res).toEqual({ projectId: 5, name: "Proj", found: true });
  });

  it("returns not found", async () => {
    mockRequest.mockResolvedValueOnce({ projects: [] });
    const res = await searchProject({ name: "None" });
    expect(res.projectId).toBe(0);
    expect(res.found).toBe(false);
  });

  it("handles errors", async () => {
    mockRequest.mockRejectedValueOnce(new Error("fail"));
    const res = await searchProject({ name: "Err" });
    expect(res.error).toBe("fail");
    expect(res.found).toBe(false);
  });
});

describe("handler", () => {
  it("parses args", async () => {
    mockRequest.mockResolvedValueOnce({ projects: [{ id: 6, name: "P" }] });
    const res = (await planfixSearchProjectTool.handler({ name: "P" })) as any;
    expect(res.projectId).toBe(6);
    expect(mockRequest).toHaveBeenCalled();
  });
});
