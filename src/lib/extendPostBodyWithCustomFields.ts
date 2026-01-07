import type {
  ContactResponse,
  CustomFieldDataType,
  TaskResponse,
} from "../types.js";
import type { CustomField } from "./extendSchemaWithCustomFields.js";
import {
  addDirectoryEntries,
  addDirectoryEntry,
} from "../lib/planfixDirectory.js";

export interface HasCustomFieldData {
  customFieldData?: CustomFieldDataType[];
  template: {
    id: number;
  };
}

export async function extendPostBodyWithCustomFields(
  postBody: HasCustomFieldData,
  args: Record<string, unknown>,
  fields: CustomField[],
  task?: TaskResponse,
  contact?: ContactResponse,
  forceUpdate?: boolean,
): Promise<void> {
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
      await addDirectoryEntry({
        objectId: postBody.template.id,
        fieldId: field.id,
        value: value as string,
        postBody,
      });
      continue;
    }
    if (field.type === "handbook_record_multiple") {
      await addDirectoryEntries({
        objectId: postBody.template.id,
        fieldId: field.id,
        values: value as string[],
        postBody,
      });
      continue;
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
