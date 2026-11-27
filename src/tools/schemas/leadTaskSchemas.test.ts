import { describe, it, expect, vi } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";

vi.mock("../../customFieldsConfig.js", () => ({
  customFieldsConfig: { contactFields: [], leadTaskFields: [] },
}));

import { AddToLeadTaskInputSchema } from "./leadTaskSchemas.js";
import { UserDataInputSchemaBase } from "../../types.js";

describe("lead task input schema", () => {
  it("tells the caller that name is the full name, not just the first name", () => {
    expect(UserDataInputSchemaBase.shape.name.description).toMatch(
      /full name.*first name and last name/i,
    );

    const json = zodToJsonSchema(AddToLeadTaskInputSchema) as {
      properties: Record<string, { type?: string; description?: string }>;
    };
    expect(json.properties.name.type).toBe("string");
    expect(json.properties.name.description).toMatch(/full name/i);
  });
});
