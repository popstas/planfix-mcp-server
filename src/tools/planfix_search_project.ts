import { z } from "zod";
import { getToolWithHandler, log, planfixRequest } from "../helpers.js";

export const PlanfixSearchProjectInputSchema = z.object({
  name: z.string(),
});

export const PlanfixSearchProjectOutputSchema = z.object({
  projectId: z.number(),
  name: z.string().optional(),
  error: z.string().optional(),
  found: z.boolean(),
});

export async function searchProject({
  name,
}: z.infer<typeof PlanfixSearchProjectInputSchema>): Promise<
  z.infer<typeof PlanfixSearchProjectOutputSchema>
> {
  const postBody = {
    offset: 0,
    pageSize: 100,
    filters: [
      {
        type: 5001,
        operator: "equal",
        value: name,
      },
    ],
    fields: "id,name,description",
  };

  try {
    const result = await planfixRequest<{
      projects?: Array<{ id: number; name: string }>;
    }>({
      path: "project/list",
      body: postBody,
    });
    if (result.projects?.[0]) {
      return {
        projectId: result.projects[0].id,
        name: result.projects[0].name,
        found: true,
      };
    }
    return { projectId: 0, found: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log(`[searchProject] Error: ${message}`);
    return { projectId: 0, error: message, found: false };
  }
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof PlanfixSearchProjectOutputSchema>> {
  const parsedArgs = PlanfixSearchProjectInputSchema.parse(args);
  return searchProject(parsedArgs);
}

export const planfixSearchProjectTool = getToolWithHandler({
  name: "planfix_search_project",
  description: "Search for a project in Planfix by name",
  inputSchema: PlanfixSearchProjectInputSchema,
  outputSchema: PlanfixSearchProjectOutputSchema,
  handler,
});

export default planfixSearchProjectTool;
