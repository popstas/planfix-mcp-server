import { z } from "zod";
import { getToolWithHandler, log } from "../helpers.js";
import { searchDirectory } from "../lib/planfixDirectory.js";

export const PlanfixSearchDirectoryInputSchema = z.object({
  name: z.string(),
});

export const PlanfixSearchDirectoryOutputSchema = z.object({
  directoryId: z.number(),
  name: z.string().optional(),
  found: z.boolean(),
  error: z.string().optional(),
});

export async function planfixSearchDirectory({
  name,
}: z.infer<typeof PlanfixSearchDirectoryInputSchema>): Promise<
  z.infer<typeof PlanfixSearchDirectoryOutputSchema>
> {
  try {
    const dir = await searchDirectory(name);
    if (dir) {
      return { directoryId: dir.id, name: dir.name, found: true };
    }
    return { directoryId: 0, found: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    log(`[planfixSearchDirectory] ${message}`);
    return { directoryId: 0, error: message, found: false };
  }
}

async function handler(args?: Record<string, unknown>) {
  const parsed = PlanfixSearchDirectoryInputSchema.parse(args);
  return planfixSearchDirectory(parsed);
}

export default getToolWithHandler({
  name: "planfix_search_directory",
  description: "Search for a Planfix directory by name",
  inputSchema: PlanfixSearchDirectoryInputSchema,
  outputSchema: PlanfixSearchDirectoryOutputSchema,
  handler,
});
