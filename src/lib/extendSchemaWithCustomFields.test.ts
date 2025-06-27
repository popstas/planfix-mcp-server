import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  extendSchemaWithCustomFields,
  type CustomField,
} from "./extendSchemaWithCustomFields.js";

describe("extendSchemaWithCustomFields", () => {
  it("adds fields of various types", () => {
    const base = z.object({ name: z.string() });
    const fields: CustomField[] = [
      { id: 1, argName: "age", type: "number" },
      { id: 2, argName: "status", type: "enum", values: ["new", "old"] },
      { id: 3, argName: "note", type: "string" },
    ];
    const schema = extendSchemaWithCustomFields(base, fields);
    const parsed = schema.parse({
      name: "John",
      age: 30,
      status: "new",
      note: "hi",
    });
    expect(parsed).toEqual({
      name: "John",
      age: 30,
      status: "new",
      note: "hi",
    });
  });

  it("skips fields without argName and treats empty enum as string", () => {
    const base = z.object({});
    const fields: CustomField[] = [
      { id: 1, argName: "", type: "string" },
      { id: 2, argName: "role", type: "enum", values: [] },
    ];
    const schema = extendSchemaWithCustomFields(base, fields);
    // field with empty argName should not be present
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((schema as any).shape[""]).toBeUndefined();
    const parsed = schema.parse({ role: "admin" });
    expect(parsed).toEqual({ role: "admin" });
  });
});
