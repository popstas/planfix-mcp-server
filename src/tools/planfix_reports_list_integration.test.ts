import { describe, expect, it } from "vitest";
import { runTool } from "../helpers.js";

describe("planfix_reports_list tool", () => {
  it("returns a list of available reports with their IDs and names", async () => {
    interface Report {
      id: number;
      name: string;
    }

    const { valid, content } = await runTool<{ reports: Report[] }>(
      "planfix_reports_list",
      {},
    );
    expect(valid).toBe(true);

    // Check that we got an array of reports
    expect(Array.isArray(content.reports)).toBe(true);

    // If there are reports, verify their structure
    if (content.reports.length > 0) {
      const report = content.reports[0];
      expect(report).toHaveProperty("id");
      expect(typeof report.id).toBe("number");
      expect(report).toHaveProperty("name");
      expect(typeof report.name).toBe("string");
    }
  });
});
