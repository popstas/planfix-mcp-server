import type {
  ContactResponse,
  CustomFieldDataType,
  TaskResponse,
} from "../types.js";
import type { CustomField } from "./extendSchemaWithCustomFields.js";

export interface HasCustomFieldData {
  customFieldData?: CustomFieldDataType[];
}

export function extendPostBodyWithCustomFields(
  postBody: HasCustomFieldData,
  args: Record<string, unknown>,
  fields: CustomField[],
  task?: TaskResponse,
  contact?: ContactResponse,
  forceUpdate?: boolean,
): void {
  if (!fields.length) return;
  for (const field of fields) {
    const value =
      (args[field.argName as keyof typeof args] as unknown) || field.default;
    if (value === undefined || value === null || value === "") continue;

    const current = task || contact;
    const currentField = current?.customFieldData?.find(
      (f) => f.field.id === Number(field.id),
    );
    let currentValue;
    if (field.type === "enum") {
      currentValue =
        currentField && Array.isArray(currentField.value)
          ? currentField?.value?.[0]
          : "";
    }
    if (field.type === "handbook_record") {
      // TODO: addDirectoryEntry
    }
    if (!forceUpdate && currentValue === value) continue;

    if (!postBody.customFieldData) postBody.customFieldData = [];
    postBody.customFieldData.push({
      field: { id: Number(field.id) },
      value: value as
        | string
        | number
        | string[]
        | { id: number }
        | { id: number }[],
    });
  }
}
