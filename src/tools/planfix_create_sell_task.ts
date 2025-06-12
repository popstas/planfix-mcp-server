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
  parent: {
    id: number;
  };
  customFieldData: CustomFieldDataType[];
  assignees?: {
    users: Array<{ id: string }>;
  };
  project?: {
    id: number;
  };
}

export const CreateSellTaskInputSchema = z.object({
  clientId: z.number(),
  leadTaskId: z.number(),
  agencyId: z.number().optional(),
  assignees: z.array(z.number()).optional(),
  name: z.string(),
  description: z.string(),
  project: z.string().optional(),
});

export const CreateSellTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string(),
});

/**
 * Create a sell task in Planfix using the SELL template, with parent task set to the lead task
 * @param clientId - The Planfix client/contact ID
 * @param leadTaskId - The Planfix lead task ID (parent)
 * @param agencyId - The Planfix agency ID (optional)
 * @param assignees - The Planfix assignees IDs (optional)
 * @param name - The name of the task
 * @param description - The description of the task
 * @param project - The name of the project (optional)
 * @returns {Promise<typeof CreateSellTaskOutputSchema>} The created task ID and URL
 */
export async function createSellTask({
  clientId,
  leadTaskId,
  agencyId,
  assignees,
  name,
  description,
  project,
}: z.infer<typeof CreateSellTaskInputSchema>): Promise<
  z.infer<typeof CreateSellTaskOutputSchema>
> {
  try {
    if (PLANFIX_DRY_RUN) {
      const mockId = 55500000 + Math.floor(Math.random() * 10000);
      log(
        `[DRY RUN] Would create sell task for client ${clientId} under lead task ${leadTaskId}`,
      );
      return { taskId: mockId, url: `https://example.com/task/${mockId}` };
    }

    const TEMPLATE_ID = Number(process.env.PLANFIX_SELL_TEMPLATE_ID);
    if (!name) name = "Продажа из бота";
    if (!description) description = "Задача продажи для клиента";

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
      parent: {
        id: leadTaskId,
      },
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

    if (assignees) {
      postBody.assignees = {
        users: assignees.map((assignee) => ({
          id: `user:${assignee}`,
        })),
      };
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

    const serviceMatrixValue = Number(
      process.env.PLANFIX_FIELD_ID_SERVICE_MATRIX_VALUE,
    );
    if (serviceMatrixValue) {
      postBody.customFieldData.push({
        field: {
          id: PLANFIX_FIELD_IDS.serviceMatrix,
        },
        value: {
          id: serviceMatrixValue,
        },
      });
    }

    const result = await planfixRequest<{ id: number }>({
      path: `task/`,
      body: postBody as unknown as Record<string, unknown>,
    });
    const taskId = result.id;
    const url = getTaskUrl(taskId);
    return { taskId, url };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[createSellTask] Error: ${errorMessage}`);
    throw error;
  }
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof CreateSellTaskOutputSchema>> {
  const parsedArgs = CreateSellTaskInputSchema.parse(args);
  return createSellTask(parsedArgs);
}

export const planfixCreateSellTaskTool = getToolWithHandler({
  name: "planfix_create_sell_task",
  description: "Create a sell task in Planfix",
  inputSchema: CreateSellTaskInputSchema,
  outputSchema: CreateSellTaskOutputSchema,
  handler,
});

export default planfixCreateSellTaskTool;
