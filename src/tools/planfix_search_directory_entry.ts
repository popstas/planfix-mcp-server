import { z } from "zod";
import { getToolWithHandler, log } from "../helpers.js";
import {
  searchDirectory,
  searchDirectoryEntryById,
  searchAllDirectoryEntries,
  getDirectoryFields,
  type DirectoryEntry,
} from "../lib/planfixDirectory.js";

export const PlanfixSearchDirectoryEntryInputSchema = z.object({
  directory: z.string().describe("Directory name"),
  entry: z.string().describe("Entry name"),
});

export const PlanfixSearchDirectoryEntryOutputSchema = z.object({
  entryId: z.number(),
  found: z.boolean(),
  error: z.string().optional(),
});

export async function planfixSearchDirectoryEntry({
  directory,
  entry,
}: z.infer<typeof PlanfixSearchDirectoryEntryInputSchema>): Promise<
  z.infer<typeof PlanfixSearchDirectoryEntryOutputSchema>
> {
  try {
    const dir = await searchDirectory(directory);
    if (!dir) {
      return { entryId: 0, found: false, error: "Directory not found" };
    }
    const fields = await getDirectoryFields(dir.id);
    if (!fields) {
      return { entryId: 0, found: false, error: "Directory fields not found" };
    }
    const field = fields[0];

    // First try exact match for performance
    const entryId = await searchDirectoryEntryById(dir.id, field.id, entry);
    if (entryId) {
      return { entryId, found: true };
    }

    // If not found, try case-insensitive search
    const allEntries = await searchAllDirectoryEntries(dir.id);
    const foundEntry = allEntries?.find(
      (e: DirectoryEntry) => e.name?.toLowerCase() === entry.toLowerCase(),
    );
    if (foundEntry?.key) {
      return { entryId: foundEntry.key, found: true };
    }
    return { entryId: 0, found: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    log(`[planfixSearchDirectoryEntry] ${message}`);
    return { entryId: 0, found: false, error: message };
  }
}

async function handler(args?: Record<string, unknown>) {
  const parsed = PlanfixSearchDirectoryEntryInputSchema.parse(args);
  return planfixSearchDirectoryEntry(parsed);
}

export default getToolWithHandler({
  name: "planfix_search_directory_entry",
  description: "Search for directory entry id by directory name and entry name",
  inputSchema: PlanfixSearchDirectoryEntryInputSchema,
  outputSchema: PlanfixSearchDirectoryEntryOutputSchema,
  handler,
});
