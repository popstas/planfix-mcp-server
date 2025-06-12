import { describe, expect, it } from "vitest";
import { runTool } from "../helpers.js";

describe("planfix_search_directory_entry tool", () => {
  it("searches directory entry by directory and entry name", async () => {
    const args = { directory: "Источники лидов", entry: "Zapier" };
    const { valid, content } = await runTool<{
      entryId: number;
      found: boolean;
    }>("planfix_search_directory_entry", args);
    expect(valid).toBe(true);
    expect(typeof content.entryId).toBe("number");
  });
});
