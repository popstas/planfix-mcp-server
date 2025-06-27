import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return { ...actual, planfixRequest: vi.fn(), log: vi.fn() };
});

import { planfixRequest, log } from "../helpers.js";
import planfixReportsListTool, { listReports } from "./planfix_reports_list.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);
const mockLog = vi.mocked(log);

describe("listReports", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns list of reports", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      result: "success",
      reports: [{ id: 1, name: "Test" }],
    });

    const res = await listReports();

    expect(mockPlanfixRequest).toHaveBeenCalledWith({
      path: "report/list",
      body: { offset: 0, pageSize: 100, fields: "id,name" },
    });
    expect(res).toEqual({ reports: [{ id: 1, name: "Test" }] });
  });

  it("handles request errors", async () => {
    mockPlanfixRequest.mockRejectedValueOnce(new Error("fail"));

    const res = await listReports();

    expect(mockLog).toHaveBeenCalled();
    expect(res).toEqual({
      reports: [],
      error: "Error listing reports: fail",
    });
  });
});

describe("planfixReportsListTool handler", () => {
  it("delegates to listReports", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      result: "success",
      reports: [],
    });

    const res = await planfixReportsListTool.handler({});

    expect(res).toEqual({ reports: [] });
    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
  });
});
