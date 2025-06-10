import { describe, expect, it } from "vitest";
import { runTool } from "../helpers.js";

describe("planfix_search_lead_task tool", () => {
  it("searches lead task by email=astrazaq@gmail.com and returns task details", async () => {
    const args = {
      email: "astrazaq@gmail.com",
    };
    const { valid, content } = await runTool<{
      taskId: number;
      found: boolean;
    }>("planfix_search_lead_task", args);
    expect(valid).toBe(true);

    const { taskId, found } = content;
    expect(typeof taskId).toBe("number");
    expect(taskId).toBeGreaterThan(0);
    expect(typeof found).toBe("boolean");
    expect(found).toBe(true);
  });

  it("returns found: false when no task is found", async () => {
    const args = {
      email: "nonexistent@example.com",
    };
    const { valid, content } = await runTool<{ found: boolean }>(
      "planfix_search_lead_task",
      args,
    );
    expect(valid).toBe(true);
    expect(content.found).toBe(false);
  });
});
