import { describe, it, expect } from "vitest";
import { UserDataInputSchema } from "../types.js";
import { AddToLeadTaskInputSchema } from "./schemas/leadTaskSchemas.js";
import { PlanfixSearchContactInputSchema } from "./planfix_search_contact.js";
import { CreatePlanfixContactInputSchema } from "./planfix_create_contact.js";
import { UpdatePlanfixContactInputSchema } from "./planfix_update_contact.js";

const tooMany = Array.from({ length: 11 }, (_, i) => `extra${i}@example.com`);

describe("additionalEmails schema hardening", () => {
  it("tolerates additionalEmails: null through addToLeadTask parsing", () => {
    const parsed = AddToLeadTaskInputSchema.parse({
      name: "John",
      email: "john@example.com",
      additionalEmails: null,
    });
    expect(parsed.additionalEmails).toBeUndefined();
  });

  it("tolerates additionalEmails: null in UserDataInputSchema", () => {
    expect(
      UserDataInputSchema.parse({ additionalEmails: null }).additionalEmails,
    ).toBeUndefined();
  });

  it("keeps a provided additionalEmails array intact", () => {
    const parsed = AddToLeadTaskInputSchema.parse({
      additionalEmails: ["a@example.com", "b@example.com"],
    });
    expect(parsed.additionalEmails).toEqual(["a@example.com", "b@example.com"]);
  });

  it("accepts exactly 10 additional emails", () => {
    const ten = tooMany.slice(0, 10);
    expect(
      UserDataInputSchema.parse({ additionalEmails: ten }).additionalEmails,
    ).toEqual(ten);
  });

  it.each([
    ["UserDataInputSchema", UserDataInputSchema],
    ["AddToLeadTaskInputSchema", AddToLeadTaskInputSchema],
    ["PlanfixSearchContactInputSchema", PlanfixSearchContactInputSchema],
    ["CreatePlanfixContactInputSchema", CreatePlanfixContactInputSchema],
    ["UpdatePlanfixContactInputSchema", UpdatePlanfixContactInputSchema],
  ])("rejects more than 10 additional emails in %s", (_name, schema) => {
    const result = schema.safeParse({
      contactId: 1,
      additionalEmails: tooMany,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("additionalEmails"),
      );
      expect(issue).toBeDefined();
      expect(issue?.message).toMatch(/10/);
    }
  });
});
