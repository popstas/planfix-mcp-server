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
import { extendSchemaWithCustomFields } from "../lib/extendSchemaWithCustomFields.js";
import { extendPostBodyWithCustomFields } from "../lib/extendPostBodyWithCustomFields.js";
import { customFieldsConfig } from "../customFieldsConfig.js";

interface TaskRequestBody {
  template: {
    id: number;
  };
  name: string;
  description: string;
  parent?: {
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

const CreateSellTaskInputSchemaBase = z.object({
  clientId: z.number(),
  leadTaskId: z.number().optional(),
  agencyId: z.number().optional(),
  assignees: z.array(z.number()).optional(),
  name: z.string(),
  description: z.string(),
  project: z.string().optional(),
});

export const CreateSellTaskInputSchema = extendSchemaWithCustomFields(
  CreateSellTaskInputSchemaBase,
  [],
);

export const CreateSellTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string(),
});

export async function createSellTask(
  args: z.infer<typeof CreateSellTaskInputSchema>,
): Promise<z.infer<typeof CreateSellTaskOutputSchema>> {
  const { clientId, leadTaskId, agencyId, assignees, project } = args;
  let { name, description } = args;

  try {
    if (PLANFIX_DRY_RUN) {
      const mockId = 55500000 + Math.floor(Math.random() * 10000);
      const leadTaskLogPart = leadTaskId
        ? ` under lead task ${leadTaskId}`
        : "";
      log(
        `[DRY RUN] Would create sell task for client ${clientId}${leadTaskLogPart}`,
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

    if (typeof leadTaskId === "number") {
      postBody.parent = {
        id: leadTaskId,
      };
    }

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

    await extendPostBodyWithCustomFields(
      postBody,
      args as Record<string, unknown>,
      customFieldsConfig.leadTaskFields,
    );

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
