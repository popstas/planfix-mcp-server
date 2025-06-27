import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return { ...actual, planfixRequest: vi.fn(), log: vi.fn() };
});

import { planfixRequest } from "../helpers.js";
import {
  getReportFields,
  planfixGetReportFieldsTool,
} from "./planfix_get_report_fields.js";

const mockRequest = vi.mocked(planfixRequest);

describe("getReportFields", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns fields when success", async () => {
    mockRequest.mockResolvedValueOnce({
      result: "success",
      repost: {
        id: 1,
        name: "Rep",
        fields: [{ id: 2, num: 1, name: "f", formula: "", hidden: false }],
      },
    });

    const res = await getReportFields({ reportId: 1 });

    expect(mockRequest).toHaveBeenCalledWith({
      path: "report/1",
      body: { fields: "id,name,fields" },
      method: "GET",
    });
    expect(res.name).toBe("Rep");
    expect(res.fields.length).toBe(1);
  });

  it("handles failed result", async () => {
    mockRequest.mockResolvedValueOnce({ result: "fail", message: "oops" });
    const res = await getReportFields({ reportId: 2 });
    expect(res.error).toContain("oops");
    expect(res.fields).toEqual([]);
    expect(res.id).toBe(2);
  });

  it("handles request error", async () => {
    mockRequest.mockRejectedValueOnce(new Error("err"));
    const res = await getReportFields({ reportId: 3 });
    expect(res.error).toContain("err");
    expect(res.fields).toEqual([]);
  });
});

describe("handler", () => {
  it("parses args", async () => {
    mockRequest.mockResolvedValueOnce({
      result: "success",
      repost: { id: 5, name: "N", fields: [] },
    });
    const res = (await planfixGetReportFieldsTool.handler({
      reportId: 5,
    })) as any;
    expect(res.id).toBe(5);
    expect(mockRequest).toHaveBeenCalled();
  });
});
