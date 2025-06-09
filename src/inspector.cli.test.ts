import { describe, expect, it } from "vitest";
import { runCli } from "./helpers.js";

describe("MCP Inspector CLI", () => {
  it("returns a tools list via tools/list", async () => {
    const args = ["--method", "tools/list"];
    const parsed = await runCli(args);
    expect(parsed).toHaveProperty("tools");
    expect(Array.isArray(parsed.tools)).toBe(true);
    expect(parsed.tools.length).toBeGreaterThan(0);
  });

  it("returns error for invalid tool name", async () => {
    const args = ["--method", "tools/call", "--tool-name", "nonexistent_tool"];
    let errorCaught = false;
    try {
      const parsed = await runCli(args);
      expect(parsed).toHaveProperty("error");
    } catch (err: any) {
      errorCaught = true;
      expect(err).toBeTruthy();
      // Optionally check error message or code
    }
    expect(errorCaught).toBe(true);
  });
});
