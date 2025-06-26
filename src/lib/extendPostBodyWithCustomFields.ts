import type { CustomFieldDataType } from "../types.js";
import type { CustomField } from "./extendSchemaWithCustomFields.js";

export interface HasCustomFieldData {
  customFieldData?: CustomFieldDataType[];
}

export function extendPostBodyWithCustomFields(
  postBody: HasCustomFieldData,
  args: Record<string, unknown>,
  fields: CustomField[],
): void {
  if (!fields.length) return;
  if (!postBody.customFieldData) postBody.customFieldData = [];
  for (const field of fields) {
    const value = (args as any)[field.argName];
    if (value === undefined || value === null || value === "") continue;
    postBody.customFieldData.push({
      field: { id: Number(field.id) },
      value: value as any,
    });
  }
}
