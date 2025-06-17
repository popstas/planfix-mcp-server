import { describe, expect, it } from "vitest";
import { runTool } from "../helpers.js";

// These tests require access to a real Planfix account

describe("planfix_search_directory tool", () => {
  it("searches directory by name", async () => {
    const args = { name: "Источники задач" };
    const { valid, content } = await runTool<{
      directoryId: number;
      found: boolean;
    }>("planfix_search_directory", args);
    expect(valid).toBe(true);
    expect(typeof content.directoryId).toBe("number");
    expect(content.directoryId).toBeGreaterThan(0);
  });
});
