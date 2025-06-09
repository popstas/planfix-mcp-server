import { describe, expect, it } from "vitest";
import { runTool } from "../helpers.js";
import { AddToLeadTaskOutputSchema } from "./planfix_add_to_lead_task.js";
import type { z } from "zod";

describe("planfix_add_to_lead_task tool", () => {
  it("should create a new lead task with contact details", async () => {
    const args = {
      name: "Станислав Попов",
      phone: "+79222229531",
      telegram: "@popstas",
      email: "pop.stas@gmail.com",
      header: "Test Lead via Automated Test",
      message: "This is a test message for adding a lead task.",
      // managerEmail: 'optional_manager@example.com', // Optional: add if specific manager assignment needs testing
    };

    const result = await runTool("planfix_add_to_lead_task", args);

    // Check if the tool execution was marked as valid by runTool wrapper
    expect(
      result.valid,
      `Tool MCP response was invalid. Raw response: ${JSON.stringify(result.parsed)}`,
    ).toBe(true);

    // Check the content returned by the tool itself
    const content = result.content as z.infer<typeof AddToLeadTaskOutputSchema>;
    expect(
      content.error,
      `Tool returned an error: ${content.error}`,
    ).toBeUndefined();

    expect(typeof content.taskId).toBe("number");
    expect(content.taskId).toBeGreaterThan(0);

    expect(typeof content.clientId).toBe("number");
    expect(content.clientId).toBeGreaterThan(0);

    expect(content.url).toContain(
      `https://expertizeme.planfix.com/task/${content.taskId}`,
    );
    expect(content.clientUrl).toContain(
      `https://expertizeme.planfix.com/contact/${content.clientId}`,
    );
  }, 60000); // Increase timeout if API calls are slow
});
