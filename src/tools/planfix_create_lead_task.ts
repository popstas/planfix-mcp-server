import {z} from 'zod';
import {PLANFIX_FIELD_IDS} from '../config.js';
import {getTaskUrl, getToolWithHandler, log, planfixRequest} from '../helpers.js';
import type {CustomFieldDataType} from '../types.js';

interface TaskRequestBody {
  template: {
    id: number;
  };
  name: string;
  description: string;
  customFieldData: CustomFieldDataType[];
}

export const CreateLeadTaskInputSchema = z.object({
  name: z.string(),
  description: z.string(),
  clientId: z.number(),
  managerId: z.number().optional(),
  agencyId: z.number().optional(),
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
 * @returns Promise with the created task ID and URL
 */
export async function createLeadTask({
                                       name,
                                       description,
                                       clientId,
                                       managerId,
                                       agencyId
                                     }: z.infer<typeof CreateLeadTaskInputSchema>): Promise<{
  taskId: number;
  url?: string;
  error?: string
}> {
  try {
    const TEMPLATE_ID = Number(process.env.PLANFIX_LEAD_TEMPLATE_ID);
    description = description.replace(/\n/g, '<br>');

    const postBody: TaskRequestBody = {
      template: {
        id: TEMPLATE_ID,
      },
      name,
      description,
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

    const result = await planfixRequest<{ id: number }>(`task/`, postBody as unknown as Record<string, unknown>);
    const taskId = result.id;
    const url = getTaskUrl(taskId);

    return {taskId, url};
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[createLeadTask] Error: ${errorMessage}`);
    return {
      taskId: 0,
      error: `Error creating task: ${errorMessage}`
    };
  }
}

export async function handler(
  args?: Record<string, unknown>
): Promise<z.infer<typeof CreateLeadTaskOutputSchema>> {
  const parsedArgs = CreateLeadTaskInputSchema.parse(args);
  return await createLeadTask(parsedArgs);
}

export const planfixCreateLeadTaskTool = getToolWithHandler({
  name: 'planfix_create_lead_task',
  description: 'Create a new lead task in Planfix',
  inputSchema: CreateLeadTaskInputSchema,
  outputSchema: CreateLeadTaskOutputSchema,
  handler,
});

export default planfixCreateLeadTaskTool;
