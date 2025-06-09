import { describe, expect, it } from "vitest";
import { runTool } from "../helpers.js";
import type { z } from "zod";
import { GetReportFieldsOutputSchema } from "./planfix_get_report_fields.js";

type ReportFields = z.infer<typeof GetReportFieldsOutputSchema>;

describe("planfix_get_report_fields tool", () => {
  it("should return report fields for a valid report ID", async () => {
    const args = {
      reportId: 5853,
    };

    const { valid, content } = await runTool<ReportFields>(
      "planfix_get_report_fields",
      args,
    );

    expect(valid).toBe(true);
    expect(content.id).toBe(args.reportId);
    expect(typeof content.name).toBe("string");
    expect(Array.isArray(content.fields)).toBe(true);

    // Check that fields have the expected structure
    if (content.fields.length > 0) {
      const field = content.fields[0];
      expect(field).toHaveProperty("id");
      expect(field).toHaveProperty("name");
      expect(field).toHaveProperty("num");
      expect(field).toHaveProperty("formula");
      expect(field).toHaveProperty("hidden");
    }
  });

  it("should handle non-existent report ID gracefully", async () => {
    const args = {
      reportId: 999999,
    };

    const { valid, content } = await runTool<ReportFields>(
      "planfix_get_report_fields",
      args,
    );

    expect(valid).toBe(true);
    expect(content.id).toBe(args.reportId);
    expect(content.error).toBeDefined();
    expect(content.fields).toEqual([]);
  });
});
