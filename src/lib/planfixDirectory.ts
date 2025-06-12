import { planfixClient } from "./planfix-client.js";
import { log } from "../helpers.js";

export interface DirectoryInfo {
  id: number;
  name: string;
}

export async function searchDirectory(
  name: string,
): Promise<DirectoryInfo | undefined> {
  try {
    const result = (await planfixClient.post<{
      directories?: Array<{ id: number; name: string }>;
    }>("directory/list", {
      offset: 0,
      pageSize: 100,
      fields: "id,name",
    })) as { directories?: Array<{ id: number; name: string }> };
    return result.directories?.find((d) => d.name === name);
  } catch (error) {
    log(`[searchDirectory] ${(error as Error).message}`);
    return undefined;
  }
}

export async function searchDirectoryEntryById(
  directoryId: number,
  entryName: string,
): Promise<number | undefined> {
  try {
    const result = (await planfixClient.post<{
      directoryEntries?: Array<{ key: number; name?: string }>;
    }>(`directory/${directoryId}/entry/list`, {
      offset: 0,
      pageSize: 100,
      fields: "key,name",
    })) as { directoryEntries?: Array<{ key: number; name?: string }> };
    return result.directoryEntries?.find((e) => e.name === entryName)?.key;
  } catch (error) {
    log(`[searchDirectoryEntryById] ${(error as Error).message}`);
    return undefined;
  }
}
