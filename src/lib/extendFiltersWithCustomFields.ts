import { log } from "../helpers.js";
import type { CustomField } from "./extendSchemaWithCustomFields.js";

export interface PlanfixFilter {
  type: number;
  operator: string;
  value?: unknown;
  field?: number;
}

const typeCodeMap = {
  contact: {
    string: 4101,
    number: 4102,
    boolean: 4103,
    enum: 4111,
  },
  task: {
    string: 101,
    number: 102,
    boolean: 105,
    enum: 111,
  },
};
export function extendFiltersWithCustomFields(
  filters: PlanfixFilter[],
  args: Record<string, unknown>,
  fields: CustomField[],
  target: "task" | "contact",
): void {
  for (const field of fields) {
    const type = (typeCodeMap as any)[target][field.type as string];
    if (!type) {
      log(`[extendFiltersWithCustomFields] Unknown type: ${field.type}, field: ${field.id}`);
      continue;
    }
    const value = args[field.argName as keyof typeof args];
    if (value === undefined || value === null || value === "") continue;
    filters.push({
      type,
      field: Number(field.id),
      operator: "equal",
      value,
    });
  }
}
