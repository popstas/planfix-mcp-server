import { describe, it, expect } from "vitest";
import { extendPostBodyWithCustomFields } from "./extendPostBodyWithCustomFields.js";
import type { HasCustomFieldData } from "./extendPostBodyWithCustomFields.js";
import type { CustomField } from "./extendSchemaWithCustomFields.js";
import type { TaskResponse, ContactResponse } from "../types.js";

describe("extendPostBodyWithCustomFields", () => {
  const stringField: CustomField = { id: 1, argName: "name", type: "string" };
  const enumField: CustomField = {
    id: 2,
    argName: "status",
    type: "enum",
    values: ["one", "two"],
  };

  it("adds custom field data from args", async () => {
    const body: HasCustomFieldData = { template: { id: 1 } };
    await extendPostBodyWithCustomFields(body, { name: "A" }, [stringField]);
    expect(body.customFieldData).toEqual([{ field: { id: 1 }, value: "A" }]);
  });

  it("uses default when arg missing", async () => {
    const body: HasCustomFieldData = { template: { id: 1 } };
    await extendPostBodyWithCustomFields(body, {}, [
      { ...stringField, default: "B" },
    ]);
    expect(body.customFieldData).toEqual([{ field: { id: 1 }, value: "B" }]);
  });

  it("skips when enum value unchanged and forceUpdate is false", async () => {
    const body: HasCustomFieldData = { template: { id: 1 } };
    const task: TaskResponse = {
      id: 1,
      customFieldData: [{ field: { id: 2 }, value: ["one"] }],
    } as TaskResponse;
    await extendPostBodyWithCustomFields(
      body,
      { status: "one" },
      [enumField],
      task,
    );
    expect(body.customFieldData).toBeUndefined();
  });

  it("updates when forceUpdate is true", async () => {
    const body: HasCustomFieldData = { template: { id: 1 } };
    const contact: ContactResponse = {
      id: 1,
      customFieldData: [{ field: { id: 2 }, value: ["one"] }],
    } as ContactResponse;
    await extendPostBodyWithCustomFields(
      body,
      { status: "one" },
      [enumField],
      undefined,
      contact,
      true,
    );
    expect(body.customFieldData).toEqual([{ field: { id: 2 }, value: "one" }]);
  });
});
