import { z } from 'zod';
import { PLANFIX_FIELD_IDS } from '../config.js';
import { log, planfixRequest, getTaskUrl, getToolWithHandler } from '../helpers.js';

export const CreateSellTaskInputSchema = z.object({
  clientId: z.number(),
  leadTaskId: z.number(),
  agencyId: z.number().optional(),
  assignees: z.array(z.number()).optional(),
  name: z.string(),
  description: z.string(),
});

export const CreateSellTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string(),
});

/**
 * Create a sell task in Planfix using the SELL template, with parent task set to the lead task
 * @param clientId - The Planfix client/contact ID
 * @param leadTaskId - The Planfix lead task ID (parent)
 * @returns {Promise<typeof CreateSellTaskOutputSchema>} The created task ID and URL
 */
export async function createSellTask({ 
  clientId, 
  leadTaskId, 
  agencyId, 
  assignees, 
  name, 
  description 
}: z.infer<typeof CreateSellTaskInputSchema>): Promise<z.infer<typeof CreateSellTaskOutputSchema>> {
  try {
    const TEMPLATE_ID = Number(process.env.PLANFIX_SELL_TEMPLATE_ID);
    if (!name) name = 'Продажа из бота';
    if (!description) description = 'Задача продажи для клиента';
    description = description.replace(/\n/g, '<br>');

    const postBody: any = {
      template: {
        id: TEMPLATE_ID,
      },
      name,
      description,
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

    if (assignees) {
      postBody.assignees = {
        users: assignees.map((assignee) => ({
          id: `user:${assignee}`
        }))
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

    const result = await planfixRequest(`task/`, postBody, 'POST');
    const taskId = result.id;
    const url = getTaskUrl(taskId);
    return { taskId, url };
  } catch (error: any) {
    log(`[createSellTask] Error: ${error.message}`);
    throw error;
  }
}

function handler(args?: Record<string, unknown>) {
  const parsedArgs = CreateSellTaskInputSchema.parse(args);
  return createSellTask(parsedArgs);
}

export const planfixCreateSellTaskTool = getToolWithHandler({
  name: 'planfix_create_sell_task',
  description: 'Create a sell task in Planfix',
  inputSchema: CreateSellTaskInputSchema,
  outputSchema: CreateSellTaskOutputSchema,
  handler,
});

export default planfixCreateSellTaskTool;
