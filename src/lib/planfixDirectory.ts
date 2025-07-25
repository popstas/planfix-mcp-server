import { log, planfixRequest } from "../helpers.js";
import { getCacheProvider } from "./cache.js";
import { getFieldDirectoryId } from "./planfixObjects.js";
import type { CustomFieldDataType } from "../types.js";

export interface DirectoryInfo {
  id: number;
  name: string;
}

export interface DirectoryEntry {
  key: number;
  name?: string;
  customFieldData?: CustomFieldDataType[];
}

export interface DirectoryField {
  id: number;
  name: string;
  type: number;
  isSystem?: boolean;
  isRequired?: boolean;
  isReadOnly?: boolean;
  isHidden?: boolean;
  isDeleted?: boolean;
  value?: unknown;
}

export async function searchDirectoryEntryById(
  directoryId: number,
  fieldId: number,
  entryName: string,
): Promise<number | undefined> {
  try {
    const result = await planfixRequest<{
      directoryEntries?: DirectoryEntry[];
    }>({
      path: `directory/${directoryId}/entry/list`,
      method: "POST",
      body: {
        offset: 0,
        pageSize: 100,
        fields: `directory,parentKey,name,key,${fieldId}`,
        entriesOnly: true,
      },
      cacheTime: 3600,
    });
    const entry = result.directoryEntries?.find((e: DirectoryEntry) => {
      const name = e.customFieldData?.find(
        (f: CustomFieldDataType) => f.field.id === fieldId,
      )?.value;
      return name === entryName;
    });
    return entry?.key;
  } catch (error) {
    log(`[searchDirectoryEntryById] ${(error as Error).message}`);
    return undefined;
  }
}

export async function searchAllDirectoryEntries(
  directoryId: number,
): Promise<DirectoryEntry[] | undefined> {
  try {
    const result = await planfixRequest<{
      directoryEntries?: DirectoryEntry[];
    }>({
      path: `directory/${directoryId}/entry/list`,
      method: "POST",
      body: {
        offset: 0,
        pageSize: 100,
        fields: "directory,parentKey,name,key",
        entriesOnly: true,
      },
      cacheTime: 3600,
    });
    return result.directoryEntries;
  } catch (error) {
    log(`[searchAllDirectoryEntries] ${(error as Error).message}`);
    return undefined;
  }
}

/**
 * Fetches metadata about a directory's fields
 * @param directoryId The ID of the directory to fetch fields for
 * @returns Array of directory fields or undefined if not found or on error
 */
export async function getDirectoryFields(
  directoryId: number,
): Promise<DirectoryField[] | undefined> {
  try {
    const result = await planfixRequest<{
      directory: {
        id: number;
        name: string;
        fields: DirectoryField[];
      };
    }>({
      path: `directory/${directoryId}?fields=id,name,fields`,
      method: "GET",
      cacheTime: 3600,
    });
    return result.directory.fields;
  } catch (error) {
    log(`[getDirectoryFields] ${(error as Error).message}`);
    return undefined;
  }
}

export async function searchDirectory(
  name: string,
): Promise<DirectoryInfo | undefined> {
  try {
    const result = (await planfixRequest<{
      directories?: Array<{ id: number; name: string }>;
    }>({
      path: "directory/list",
      method: "POST",
      body: {
        offset: 0,
        pageSize: 100,
        fields: "id,name",
      },
      cacheTime: 3600,
    })) as { directories?: Array<{ id: number; name: string }> };
    return result.directories?.find((d) => d.name === name);
  } catch (error) {
    log(`[searchDirectory] ${(error as Error).message}`);
    return undefined;
  }
}

export async function createDirectoryEntry(
  directoryId: number,
  fieldId: number,
  entryName: string,
): Promise<number | undefined> {
  try {
    const result = await planfixRequest<{
      key?: number;
      entry?: { key: number };
    }>({
      path: `directory/${directoryId}/entry/`,
      body: {
        customFieldData: [
          {
            field: { id: fieldId },
            value: entryName,
          },
        ],
      },
    });
    const key =
      (result as { key?: number; entry?: { key: number } }).key ??
      (result as { key?: number; entry?: { key: number } }).entry?.key;
    const cache = getCacheProvider();
    await cache.deletePrefix?.(`directory/${directoryId}`);
    return typeof key === "number" ? key : undefined;
  } catch (error) {
    log(`[createDirectoryEntry] ${(error as Error).message}`);
    return undefined;
  }
}
export interface AddDirectoryEntryArgs {
  objectId: number;
  fieldId: number;
  value: string;
  postBody: { customFieldData?: CustomFieldDataType[] };
}

export async function addDirectoryEntry({
  objectId,
  fieldId,
  value,
  postBody,
}: AddDirectoryEntryArgs): Promise<number | undefined> {
  const directoryId = await getFieldDirectoryId({ objectId, fieldId });
  if (!directoryId) return undefined;
  const directoryFields = await getDirectoryFields(directoryId);
  const directoryFieldId = directoryFields?.[0]?.id || 0;
  let entryId = await searchDirectoryEntryById(
    directoryId,
    directoryFieldId,
    value,
  );
  if (!entryId) {
    entryId = await createDirectoryEntry(directoryId, directoryFieldId, value);
  }
  if (entryId) {
    if (!postBody.customFieldData) postBody.customFieldData = [];
    postBody.customFieldData.push({
      field: { id: fieldId },
      value: { id: entryId },
    });
  }
  return entryId;
}

export interface AddDirectoryEntriesArgs {
  objectId: number;
  fieldId: number;
  values: string[];
  postBody: { customFieldData?: CustomFieldDataType[] };
}

export async function addDirectoryEntries({
  objectId,
  fieldId,
  values,
  postBody,
}: AddDirectoryEntriesArgs): Promise<number[] | undefined> {
  if (!values.length) return [];
  const directoryId = await getFieldDirectoryId({ objectId, fieldId });
  if (!directoryId) return undefined;
  const directoryFields = await getDirectoryFields(directoryId);
  const directoryFieldId = directoryFields?.[0]?.id || 0;
  const ids: number[] = [];
  for (const value of values) {
    let id = await searchDirectoryEntryById(
      directoryId,
      directoryFieldId,
      value,
    );
    if (!id) {
      id = await createDirectoryEntry(directoryId, directoryFieldId, value);
    }
    if (id) ids.push(id);
  }
  if (ids.length) {
    if (!postBody.customFieldData) postBody.customFieldData = [];
    postBody.customFieldData.push({
      field: { id: fieldId },
      value: ids.map((id) => ({ id })),
    });
  }
  return ids;
}
