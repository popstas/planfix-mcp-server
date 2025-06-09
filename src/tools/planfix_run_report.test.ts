import { describe, it, expect, vi, beforeEach } from "vitest";
import type { z } from "zod";

// Mock the fs/promises module first
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock the helpers module
vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn(),
    withCache: vi.fn((_name, fn) => fn()),
    runTool: vi.fn(),
  };
});

// Import the actual implementation for type checking
import { runTool, planfixRequest, withCache } from "../helpers.js";
import { RunReportOutputSchema } from "./planfix_run_report.js";

type RunReportOutput = z.infer<typeof RunReportOutputSchema>;

// Get the mocked functions
const mockPlanfixRequest = vi.mocked(planfixRequest);
const mockRunTool = vi.mocked(runTool);
const mockWithCache = vi.mocked(withCache);

describe("planfix_run_report tool", () => {
  const mockReportData = [
    {
      type: "Header",
      items: [{ text: "ID" }, { text: "Name" }],
    },
    {
      type: "Normal",
      items: [{ text: "1" }, { text: "Test Task" }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock planfixRequest for report generation
    mockPlanfixRequest
      .mockResolvedValueOnce({ result: "success", requestId: "123" }) // generateReport response
      .mockResolvedValueOnce({
        result: "success",
        status: "ready",
        save: { id: 1, name: "test", reportId: 1 },
      }) // report status response
      .mockResolvedValueOnce({
        data: { rows: mockReportData },
      }); // report data response
  });

  it("runs a report and returns the data", async () => {
    const args = {
      reportId: 1,
    };

    // Mock the runTool response
    const mockResponse: RunReportOutput = {
      success: true,
      rows: [{ ID: "1", Name: "Test Task" }],
    };

    // Mock the runTool function to return our mock response
    mockRunTool.mockResolvedValueOnce({
      valid: true,
      content: mockResponse,
      parsed: {
        content: [{ text: "success" }],
        structuredContent: {
          content: mockResponse,
        },
      },
    });

    const result = await runTool("planfix_run_report", args);

    // Assert the response structure
    expect(result.valid).toBe(true);
    if (result.valid) {
      const content = result.content as RunReportOutput;
      expect(content.success).toBe(true);
      expect(Array.isArray(content.rows)).toBe(true);

      if (content.rows && content.rows.length > 0) {
        expect(content.rows[0]).toHaveProperty("ID");
        expect(content.rows[0]).toHaveProperty("Name");
      } else {
        throw new Error("No rows returned in report");
      }
    }
  });

  it("uses cache when available", async () => {
    const args = { reportId: 1 };

    // Prepare a fake PlanfixReportData
    const cachedPlanfixData = [
      { type: "Header", items: [{ text: "ID" }, { text: "Name" }] },
      { type: "Normal", items: [{ text: "2" }, { text: "Cached Task" }] },
    ];

    // Mock withCache to return our fake data
    mockWithCache.mockImplementationOnce(async (name, fn) => {
      if (name === `planfix_report_${args.reportId}`) {
        return cachedPlanfixData;
      }
      return fn();
    });

    // Call the actual runReport function
    const { runReport } = await import("./planfix_run_report.js");
    const result = await runReport(args);

    // Assert that runReport returns the cached rows
    expect(result.success).toBe(true);
    expect(result.rows).toBeDefined();
    expect(result.rows![0]).toEqual({ ID: "2", Name: "Cached Task" });

    // Verify planfixRequest was not called (cache hit)
    expect(mockPlanfixRequest).not.toHaveBeenCalled();
  });
});

import { processRows } from "./planfix_run_report.js";

describe("processRows grouping and sorting", () => {
  const sampleRows = [
    { date: "2024-04-12T20:10:00Z", value: "b" },
    { date: "2024-04-13T01:15:00Z", value: "a" },
  ];

  it("groups by day", () => {
    const res = processRows(sampleRows, ["date"], "day");
    expect(res[0].date).toBe("2024-04-12");
    expect(res[1].date).toBe("2024-04-13");
  });

  it("groups by month", () => {
    const res = processRows(sampleRows, ["date"], "month");
    expect(res.every((r) => r.date === "2024-04")).toBe(true);
  });

  it("groups by week", () => {
    const res = processRows(sampleRows, ["date"], "week");
    // 2024-04-12 is in week 15 of 2024
    expect(res[0].date).toMatch(/^2024-W15$/);
  });

  it("sorts by value", () => {
    const unsorted = [{ value: "b" }, { value: "a" }];
    const res = processRows(unsorted, [], undefined, ["value"]);
    expect(res.map((r) => r.value)).toEqual(["a", "b"]);
  });

  it("applies grouping then sorting", () => {
    const rows = [
      { date: "2024-04-12T20:10:00Z", value: "c" },
      { date: "2024-04-12T08:00:00Z", value: "a" },
      { date: "2024-04-13T00:00:00Z", value: "b" },
    ];
    const res = processRows(rows, ["date"], "day", ["value"]);
    expect(res.map((r) => r.value)).toEqual(["a", "c", "b"]);
  });
});
