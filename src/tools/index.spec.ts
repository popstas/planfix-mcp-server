import { execa } from "execa";
import { describe, expect, it } from "vitest";

const CLI_SCRIPT = "npm";
const CLI_ARGS = ["-s", "run", "mcp-cli", "--"];

async function runCli(args: string[]) {
  try {
    const { stdout } = await execa(CLI_SCRIPT, args, { stdin: "inherit" });
    return JSON.parse(stdout);
  } catch (error: any) {
    if (error.stdout) console.error("CLI STDOUT:", error.stdout);
    if (error.stderr) console.error("CLI STDERR:", error.stderr);
    throw error;
  }
}

describe("MCP Inspector CLI", () => {
  it("returns a tools list via tools/list", async () => {
    const args = [...CLI_ARGS, "--method", "tools/list"];
    const parsed = await runCli(args);
    expect(parsed).toHaveProperty("tools");
    expect(Array.isArray(parsed.tools)).toBe(true);
    expect(parsed.tools.length).toBeGreaterThan(0);
  });

  it("returns error for invalid tool name", async () => {
    const args = [
      ...CLI_ARGS,
      "--method",
      "tools/call",
      "--tool-name",
      "nonexistent_tool",
    ];
    let errorCaught = false;
    try {
      const parsed = await runCli(args);
      expect(parsed).toHaveProperty("error");
    } catch (err: any) {
      errorCaught = true;
      expect(err).toBeTruthy();
    }
    expect(errorCaught).toBe(true);
  });
});
