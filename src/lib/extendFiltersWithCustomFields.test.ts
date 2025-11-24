import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extendFiltersWithCustomFields,
  type PlanfixFilter,
} from "./extendFiltersWithCustomFields.js";
import { log } from "../helpers.js";
import type { CustomField } from "./extendSchemaWithCustomFields.js";

vi.mock("../helpers.js", () => ({ log: vi.fn() }));
const mockedLog = vi.mocked(log);

describe("extendFiltersWithCustomFields", () => {
  beforeEach(() => {
    mockedLog.mockClear();
  });

  it("adds filters for provided values", () => {
    const fields: CustomField[] = [{ id: 1, argName: "name", type: "string" }];
    const filters: PlanfixFilter[] = [];
    extendFiltersWithCustomFields(filters, { name: "John" }, fields, "contact");
    expect(filters).toEqual([
      { type: 4101, field: 1, operator: "equal", value: "John" },
    ]);
  });

  it("skips fields with empty values", () => {
    const fields: CustomField[] = [{ id: 1, argName: "name", type: "string" }];
    const filters: PlanfixFilter[] = [];
    extendFiltersWithCustomFields(filters, {}, fields, "contact");
    extendFiltersWithCustomFields(filters, { name: "" }, fields, "contact");
    expect(filters.length).toBe(0);
  });

  it("logs unknown field types", () => {
    const fields: CustomField[] = [
      { id: 1, argName: "foo", type: "unknown" as any },
    ];
    const filters: PlanfixFilter[] = [];
    extendFiltersWithCustomFields(filters, { foo: "bar" }, fields, "contact");
    expect(mockedLog).toHaveBeenCalled();
    expect(filters.length).toBe(0);
  });

  it("adds filters for user custom fields", () => {
    const fields: CustomField[] = [
      { id: 5, argName: "dept", type: "enum", values: ["a"] },
    ];
    const filters: PlanfixFilter[] = [];
    extendFiltersWithCustomFields(filters, { dept: "a" }, fields, "user");
    expect(filters).toEqual([
      { type: 9111, field: 5, operator: "equal", value: "a" },
    ]);
  });
});
