import { describe, expect, it } from "vitest";
import { runTool } from "../helpers.js";
import { AddToLeadTaskOutputSchema } from "./planfix_add_to_lead_task.js";
import type { z } from "zod";

describe("planfix_add_to_lead_task tool", () => {
  it("should create a new lead task with contact details", async () => {
    const args = {
      name: "Станислав Попов",
      phone: "+79222222222",
      telegram: "@pop.stas",
      email: "pop.stas@gmail.com",
      title: "Test Lead via Automated Test",
      pipeline: "Test2",
      description: "This is a test message for adding a lead task.",
    };

    const result = await runTool("planfix_add_to_lead_task", args);
    expect(result.valid).toBe(true);
    
    const content = result.content as z.infer<typeof AddToLeadTaskOutputSchema>;
    expect(content.error).toBeUndefined();
    
    expect(typeof content.taskId).toBe("number");
    expect(content.taskId).toBeGreaterThan(0);
    expect(typeof content.clientId).toBe("number");
    expect(content.clientId).toBeGreaterThan(0);
    expect(content.url).toContain(
      `https://popstas.planfix.com/task/${content.taskId}`,
    );
    expect(content.clientUrl).toContain(
      `https://popstas.planfix.com/contact/${content.clientId}`,
    );
  }, 60000);

  describe("name fallback logic", () => {
    it("should use telegram as name when name is not provided", async () => {
      const args = {
        phone: "+79222222222",
        telegram: "@testtelegram",
        email: "test@example.com",
        title: "Test Name Fallback - Telegram",
        description: "This should use telegram as the name",
        pipeline: "Test2",
      };

      const result = await runTool("planfix_add_to_lead_task", args);
      expect(result.valid).toBe(true);
      
      const content = result.content as z.infer<typeof AddToLeadTaskOutputSchema>;
      expect(content.error).toBeUndefined();
      expect(content.clientId).toBeGreaterThan(0);
    }, 60000);

    it("should use phone as name when name and telegram are not provided", async () => {
      const args = {
        phone: "+79222222222",
        email: "test2@example.com",
        title: "Test Name Fallback - Phone",
        description: "This should use phone as the name",
        pipeline: "Test2",
      };

      const result = await runTool("planfix_add_to_lead_task", args);
      expect(result.valid).toBe(true);
      
      const content = result.content as z.infer<typeof AddToLeadTaskOutputSchema>;
      expect(content.error).toBeUndefined();
      expect(content.clientId).toBeGreaterThan(0);
    }, 60000);

    it("should use email as name when name, telegram and phone are not provided", async () => {
      const args = {
        email: "test3@example.com",
        title: "Test Name Fallback - Email",
        description: "This should use email as the name",
        pipeline: "Test2",
      };

      const result = await runTool("planfix_add_to_lead_task", args);
      expect(result.valid).toBe(true);
      
      const content = result.content as z.infer<typeof AddToLeadTaskOutputSchema>;
      expect(content.error).toBeUndefined();
      expect(content.clientId).toBeGreaterThan(0);
    }, 60000);

    it("should use default name when no contact info is provided", async () => {
      const args = {
        title: "Test Name Fallback - Default",
        description: "This should use default client name",
        pipeline: "Test2",
      };

      const result = await runTool("planfix_add_to_lead_task", args);
      expect(result.valid).toBe(true);
      
      const content = result.content as z.infer<typeof AddToLeadTaskOutputSchema>;
      expect(content.error).toBeUndefined();
      expect(content.clientId).toBe(0);
      expect(content.clientUrl).toBeDefined();
    }, 60000);
  });
});
