import { readFileSync, existsSync } from "fs";
import path from "path";

interface CoverageMetrics {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface FileCoverage {
  lines: CoverageMetrics;
  statements: CoverageMetrics;
  functions: CoverageMetrics;
  branches: CoverageMetrics;
}

interface CoverageSummary {
  total: FileCoverage;
  [filePath: string]: FileCoverage;
}

export interface FileCoverageInfo {
  path: string;
  lines_total: number;
  lines_covered: number;
  lines_uncovered: number;
  lines_coverage: number;
  functions_total: number;
  functions_covered: number;
  functions_uncovered: number;
  functions_coverage: number;
}

function toRelativePath(filePath: string): string {
  return filePath.replace(process.cwd(), "").replace(/\\/g, "/");
}

export function parseCoverage(
  coveragePath = "coverage/coverage-summary.json",
): FileCoverageInfo[] {
  const absolutePath = path.resolve(process.cwd(), coveragePath);

  if (!existsSync(absolutePath)) {
    return [];
  }

  try {
    const coverageData: CoverageSummary = JSON.parse(
      readFileSync(absolutePath, "utf-8"),
    );

    return Object.entries(coverageData)
      .filter(([key]) => key !== "total")
      .map(([filePath, fileCoverage]) => ({
        path: toRelativePath(filePath),
        lines_total: fileCoverage.lines.total,
        lines_covered: fileCoverage.lines.covered,
        lines_uncovered: fileCoverage.lines.total - fileCoverage.lines.covered,
        lines_coverage: fileCoverage.lines.pct,
        functions_total: fileCoverage.functions.total,
        functions_covered: fileCoverage.functions.covered,
        functions_uncovered:
          fileCoverage.functions.total - fileCoverage.functions.covered,
        functions_coverage: fileCoverage.functions.pct,
      }))
      .sort((a, b) => b.lines_uncovered - a.lines_uncovered);
  } catch (error) {
    console.error("Error parsing coverage file:", error);
    return [];
  }
}

export function coverageInfo(
  coveragePath = "coverage/coverage-summary.json",
): void {
  const coverage = parseCoverage(coveragePath);
  console.log(JSON.stringify(coverage, null, 2));
}

// Convert file path to URL format for comparison
function toFileUrl(filePath: string): string {
  const pathName = path.resolve(filePath).replace(/\\/g, "/");
  return `file://${pathName.startsWith("/") ? "" : "/"}${pathName}`;
}

// Run if this file is executed directly
const currentFileUrl = toFileUrl(process.argv[1]);
if (import.meta.url === currentFileUrl) {
  coverageInfo();
}
