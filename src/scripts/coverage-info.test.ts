import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

import { parseCoverage, coverageInfo } from "./coverage-info.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseCoverage", () => {
  it("parses and sorts coverage data", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cov-"));
    const file = path.join(tmpDir, "summary.json");
    const data = {
      total: {
        lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
        statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
        functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
        branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
      },
    } as any;
    const fileA = path.join(process.cwd(), "src", "a.ts");
    const fileB = path.join(process.cwd(), "src", "b.ts");
    data[fileA] = {
      lines: { total: 10, covered: 5, skipped: 0, pct: 50 },
      statements: { total: 10, covered: 5, skipped: 0, pct: 50 },
      functions: { total: 2, covered: 1, skipped: 0, pct: 50 },
      branches: { total: 0, covered: 0, skipped: 0, pct: 100 },
    };
    data[fileB] = {
      lines: { total: 8, covered: 8, skipped: 0, pct: 100 },
      statements: { total: 8, covered: 8, skipped: 0, pct: 100 },
      functions: { total: 1, covered: 1, skipped: 0, pct: 100 },
      branches: { total: 0, covered: 0, skipped: 0, pct: 100 },
    };
    fs.writeFileSync(file, JSON.stringify(data));

    const result = parseCoverage(file);
    expect(result.length).toBe(2);
    expect(result[0].path).toContain("a.ts");
    expect(result[0].lines_uncovered).toBe(5);
    expect(result[1].path).toContain("b.ts");
  });

  it("parses non-existing file", () => {
    const result = parseCoverage("non-existing-file.json");
    expect(result).toEqual([]);
  });

  it("throws on invalid file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cov-"));
    const file = path.join(tmpDir, "summary.json");
    fs.writeFileSync(file, "invalid");
    const result = parseCoverage(file);
    expect(result).toEqual([]);
  });
});

describe("coverageInfo", () => {
  it("prints parsed coverage", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cov-"));
    const file = path.join(tmpDir, "summary.json");
    const data = {
      total: {
        lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
        statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
        functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
        branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
      },
    } as any;
    const fileA = path.join(process.cwd(), "src", "c.ts");
    data[fileA] = {
      lines: { total: 4, covered: 2, skipped: 0, pct: 50 },
      statements: { total: 4, covered: 2, skipped: 0, pct: 50 },
      functions: { total: 1, covered: 0, skipped: 0, pct: 0 },
      branches: { total: 0, covered: 0, skipped: 0, pct: 100 },
    };
    fs.writeFileSync(file, JSON.stringify(data));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    coverageInfo(file);

    const expected = JSON.stringify(parseCoverage(file), null, 2);
    expect(logSpy).toHaveBeenCalledWith(expected);
  });
});
