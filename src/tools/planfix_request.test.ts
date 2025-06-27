import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return { ...actual, planfixRequest: vi.fn() };
});

import { planfixRequest } from "../helpers.js";
import { planfixRequestHandler } from "./planfix_request.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);

afterEach(() => {
  vi.clearAllMocks();
});

describe("planfixRequestHandler", () => {
  it("returns response when request succeeds", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({ ok: true });
    const res = await planfixRequestHandler({
      method: "POST",
      path: "task/list",
      body: { a: 1 },
    });
    expect(res).toEqual({ ok: true });
    expect(mockPlanfixRequest).toHaveBeenCalledWith({
      path: "task/list",
      body: { a: 1 },
      method: "POST",
      cacheTime: undefined,
    });
  });

  it("returns error object on failure", async () => {
    mockPlanfixRequest.mockRejectedValueOnce(new Error("fail"));
    const res = await planfixRequestHandler({ method: "GET", path: "bad" });
    expect(res).toEqual({
      success: false,
      error: "fail",
      path: "bad",
      method: "GET",
    });
  });
});
