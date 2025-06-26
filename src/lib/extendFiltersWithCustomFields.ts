import type { CustomField } from "./extendSchemaWithCustomFields.js";

export interface PlanfixFilter {
  type: number;
  operator: string;
  value?: unknown;
  field?: number;
}

export function extendFiltersWithCustomFields(
  filters: PlanfixFilter[],
  args: Record<string, unknown>,
  fields: CustomField[],
  target: "task" | "contact",
): void {
  const typeCode = target === "task" ? 102 : 4101;
  for (const field of fields) {
    const value = (args as any)[field.argName];
    if (value === undefined || value === null || value === "") continue;
    filters.push({
      type: typeCode,
      field: Number(field.id),
      operator: "equal",
      value,
    });
  }
}
