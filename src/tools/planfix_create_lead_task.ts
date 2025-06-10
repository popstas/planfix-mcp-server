import { z } from "zod";
import { PLANFIX_DRY_RUN, PLANFIX_FIELD_IDS } from "../config.js";
import {
  getTaskUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import type { CustomFieldDataType } from "../types.js";
import { searchProject } from "./planfix_search_project.js";

interface TaskRequestBody {
  template: {
    id: number;
  };
  name: string;
  description: string;
  customFieldData: CustomFieldDataType[];
  project?: {
    id: number;
  };
}

export const CreateLeadTaskInputSchema = z.object({
  name: z.string(),
  description: z.string(),
  clientId: z.number(),
  managerId: z.number().optional(),
  agencyId: z.number().optional(),
  project: z.string().optional(),
});

export const CreateLeadTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Create a new lead task in Planfix
 * @param name - The name of the task
 * @param description - The description of the task
 * @param clientId - The ID of the client
 * @param managerId - Optional ID of the manager
 * @param agencyId - Optional ID of the agency
 * @param project - Optional name of the project
 * @returns Promise with the created task ID and URL
 */
export async function createLeadTask({
  name,
  description,
  clientId,
  managerId,
  agencyId,
  project,
}: z.infer<typeof CreateLeadTaskInputSchema>): Promise<{
  taskId: number;
  url?: string;
  error?: string;
}> {
  const TEMPLATE_ID = Number(process.env.PLANFIX_LEAD_TEMPLATE_ID);
  let finalDescription = description;
  let finalProjectId = 0;

  if (project) {
    const projectResult = await searchProject({ name: project });
    if (projectResult.found) {
      finalProjectId = projectResult.projectId;
    } else {
      finalDescription = `${finalDescription}\nПроект: ${project}`;
    }
  }

  finalDescription = finalDescription.replace(/\n/g, "<br>");

  const postBody: TaskRequestBody = {
    template: {
      id: TEMPLATE_ID,
    },
    name,
    description: finalDescription,
    customFieldData: [
      {
        field: {
          id: PLANFIX_FIELD_IDS.client,
        },
        value: {
          id: clientId,
        },
      },
    ],
  };

  if (finalProjectId) {
    postBody.project = { id: finalProjectId };
  }

  if (managerId) {
    postBody.customFieldData.push({
      field: {
        id: PLANFIX_FIELD_IDS.manager,
      },
      value: {
        id: managerId,
      },
    });
  }

  const leadSourceValue = Number(
    process.env.PLANFIX_FIELD_ID_LEAD_SOURCE_VALUE,
  );
  if (leadSourceValue) {
    postBody.customFieldData.push({
      field: {
        id: PLANFIX_FIELD_IDS.leadSource,
      },
      value: {
        id: leadSourceValue,
      },
    });
  }

  if (agencyId) {
    postBody.customFieldData.push({
      field: {
        id: PLANFIX_FIELD_IDS.agency,
      },
      value: {
        id: agencyId,
      },
    });
  }

  try {
    if (PLANFIX_DRY_RUN) {
      const mockId = 55500000 + Math.floor(Math.random() * 10000);
      log(`[DRY RUN] Would create lead task: ${name}`);
      return { taskId: mockId, url: `https://example.com/task/${mockId}` };
    }

    const result = await planfixRequest<{ id: number }>(
      `task/`,
      postBody as unknown as Record<string, unknown>,
    );
    const taskId = result.id;
    const url = getTaskUrl(taskId);

    return { taskId, url };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[createLeadTask] Error: ${errorMessage}`);
    const requestStr = JSON.stringify(postBody);
    return {
      taskId: 0,
      error: `Error creating task: ${errorMessage}, request: ${requestStr}`,
    };
  }
}

export async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof CreateLeadTaskOutputSchema>> {
  const parsedArgs = CreateLeadTaskInputSchema.parse(args);
  return await createLeadTask(parsedArgs);
}

export const planfixCreateLeadTaskTool = getToolWithHandler({
  name: "planfix_create_lead_task",
  description: "Create a new lead task in Planfix",
  inputSchema: CreateLeadTaskInputSchema,
  outputSchema: CreateLeadTaskOutputSchema,
  handler,
});

export default planfixCreateLeadTaskTool;
