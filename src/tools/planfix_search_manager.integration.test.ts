import { describe, expect, it } from "vitest";
import { runTool } from "../helpers.js";

describe("planfix_search_manager tool", () => {
  it("searches manager by email=smirnov@expertizeme.org and returns manager details", async () => {
    const args = {
      email: "smirnov@expertizeme.org",
    };
    const { valid, content } = await runTool<{
      managerId: number;
      found: boolean;
    }>("planfix_search_manager", args);
    expect(valid).toBe(true);

    const { managerId, found } = content;
    expect(typeof managerId).toBe("number");
    expect(managerId).toBeGreaterThan(0);
    expect(typeof found).toBe("boolean");
    expect(found).toBe(true);
  });

  it("returns found: false when no manager is found", async () => {
    const args = {
      email: "nonexistent@example.com",
    };
    const { valid, content } = await runTool<{ found: boolean }>(
      "planfix_search_manager",
      args,
    );
    expect(valid).toBe(true);
    expect(content.found).toBe(false);
  });
});
