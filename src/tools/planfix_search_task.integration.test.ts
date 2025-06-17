import { describe, expect, it } from "vitest";
import { runTool } from "../helpers.js";

describe("planfix_search_task tool", () => {
  it('searches task by name="Корягин Егор - работа с клиентом" and returns task details', async () => {
    const args = {
      taskTitle: "Корягин Егор - работа с клиентом",
    };
    const { valid, content } = await runTool<{
      taskId: number;
      found: boolean;
    }>("planfix_search_task", args);
    expect(valid).toBe(true);

    const { taskId, found } = content;
    expect(typeof taskId).toBe("number");
    expect(taskId).toBeGreaterThan(0);
    expect(typeof found).toBe("boolean");
    expect(found).toBe(true);
  });

  it("searches task by clientId and returns task details", async () => {
    const args = {
      clientId: 12345, // Replace with a valid client ID for testing
    };
    const { valid, content } = await runTool<{
      taskId: number;
      found: boolean;
    }>("planfix_search_task", args);
    expect(valid).toBe(true);

    const { taskId, found } = content;
    expect(typeof taskId).toBe("number");
    expect(typeof found).toBe("boolean");
    // Task might or might not be found depending on the test data
  });

  it("returns found: false when no task is found", async () => {
    const args = {
      taskTitle: "Nonexistent Task Name 12345",
    };
    const { valid, content } = await runTool<{ found: boolean }>(
      "planfix_search_task",
      args,
    );
    expect(valid).toBe(true);
    expect(content.found).toBe(false);
  });
});
