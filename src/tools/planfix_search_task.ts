import { z } from 'zod';
import { PLANFIX_FIELD_IDS } from '../config.js';
import { planfixRequest, getTaskUrl, getToolWithHandler } from '../helpers.js';

export const SearchPlanfixTaskInputSchema = z.object({
  taskName: z.string().optional(),
  clientId: z.number().optional(),
});

export const SearchPlanfixTaskOutputSchema = z.object({
  taskId: z.number().optional(),
  assignees: z.array(z.any()).optional(),
  url: z.string().optional(),
  error: z.string().optional(),
});

export async function searchPlanfixTask({ taskName, clientId }: { taskName?: string; clientId?: number }): Promise<{ taskId?: number; assignees?: any; url?: string; error?: string }> {
  // console.log('Searching Planfix task...');
  let taskId: number | undefined = undefined;
  let assignees: any = undefined;
  let description: string | undefined = undefined;
  
  const TEMPLATE_ID = Number(process.env.PLANFIX_LEAD_TEMPLATE_ID);
  const DAYS_TO_SEARCH = Number(process.env.PLANFIX_DAYS_TO_SEARCH) || 3;

  const postBody: any = {
    offset: 0,
    pageSize: 100,
    filters: [],
    fields: 'id,name,description,template,assignees',
  };

  const filtersDefault = [
    {
      type: 51, // filter by template
      operator: 'equal',
      value: TEMPLATE_ID,
    },
  ];

  const filters = {
    byClient: {
      type: 108,
      field: PLANFIX_FIELD_IDS.client,
      operator: 'equal',
      value: `contact:${clientId}`,
    },
    byName: {
      type: 8,
      operator: 'equal',
      value: taskName,
    },
    byLastDays: {
      type: 12, // by last days
      operator: 'greaterOrEqual',
      value: Math.floor(Date.now() / 1000) - DAYS_TO_SEARCH * 24 * 3600,
    },
  };

  async function searchWithFilter(filtersArr: any[], label: string) {
    // console.log(`search task with filter: ${label}`);
    postBody.filters = [...filtersDefault, ...filtersArr];
    try {
      const result = await planfixRequest(`task/list`, postBody);
      if (result.tasks && result.tasks.length > 0) {
        taskId = result.tasks[0].id;
        assignees = result.tasks[0].assignees;
        description = result.tasks[0].description;
        // console.log(`Task found by ${label}: ${taskId}`);
      }
      return { taskId, assignees, description };
    } catch (error: any) {
      return { taskId: 0, error: `Error searching for tasks: ${error.message}` };
    }
  }
  try {
    if (clientId) {
      const result = await searchWithFilter([filters.byClient], 'client');
      taskId = result.taskId;
      assignees = result.assignees;
      description = result.description;
    }
    if (!taskId && taskName) {
      const result = await searchWithFilter([filters.byName, filters.byLastDays], 'name');
      taskId = result.taskId;
      assignees = result.assignees;
      description = result.description;
    }
    const url = getTaskUrl(taskId);
    return { taskId, assignees, url };
  } catch (error: any) {
    return { taskId: 0, assignees: undefined, url: undefined, error: `Error searching for tasks: ${error.message}` };
  }
}

function handler(args?: Record<string, unknown>): Promise<z.infer<typeof SearchPlanfixTaskOutputSchema>> {
  args = SearchPlanfixTaskInputSchema.parse(args);
  return searchPlanfixTask(args);
}

export const planfixSearchTaskTool = getToolWithHandler({
  name: 'planfix_search_task',
  description: 'Search for a task in Planfix by name or client ID',
  inputSchema: SearchPlanfixTaskInputSchema,
  outputSchema: SearchPlanfixTaskOutputSchema,
  handler,
});

export default planfixSearchTaskTool;
