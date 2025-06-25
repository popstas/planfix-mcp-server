import { log, planfixRequest } from "../helpers.js";

export interface CustomFieldInfo {
  id: number;
  name: string;
}

/**
 * Retrieve the name of a custom task field by its ID.
 */
export async function getTaskCustomFieldName(
  fieldId: number,
): Promise<string | undefined> {
  try {
    const result = await planfixRequest<{ customfields?: CustomFieldInfo[] }>({
      path: `customfield/task`,
      method: "GET",
      body: { fields: "id,name" },
      cacheTime: 3600,
    });
    const field = result.customfields?.find((f) => f.id === fieldId);
    return field?.name;
  } catch (error) {
    log(`[getTaskCustomFieldName] ${(error as Error).message}`);
    return undefined;
  }
}
