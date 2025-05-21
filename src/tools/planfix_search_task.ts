import {z} from 'zod';
import {PLANFIX_FIELD_IDS} from '../config.js';
import {getTaskUrl, getToolWithHandler, planfixRequest} from '../helpers.js';

export const SearchPlanfixTaskInputSchema = z.object({
  taskName: z.string().optional(),
  clientId: z.number().optional(),
});

export const SearchPlanfixTaskOutputSchema = z.object({
  taskId: z.number().optional(),
  assignees: z.object({
    users: z.array(z.object({
      id: z.string(),
      name: z.string().optional(),
    })),
  }).optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  error: z.string().optional(),
  found: z.boolean(),
});

interface Assignee {
  id: string;
  name?: string;
}

export async function searchPlanfixTask(
  {
    taskName,
    clientId
  }: {
    taskName?: string;
    clientId?: number
  }): Promise<z.infer<typeof SearchPlanfixTaskOutputSchema>> {
  let taskId: number | undefined = undefined;
  let assignees: { users: Assignee[] } | undefined;

  const TEMPLATE_ID = Number(process.env.PLANFIX_LEAD_TEMPLATE_ID);
  // const DAYS_TO_SEARCH = Number(process.env.PLANFIX_DAYS_TO_SEARCH) || 1000;

  const postBody = {
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
    /*byLastDays: {
      type: 12, // created, by last days
      operator: 'last',
      value: {
        dateValue: DAYS_TO_SEARCH,
      },
    },*/
  };

  async function searchWithFilter(
    filtersArr: Array<Record<string, unknown>>
  ): Promise<z.infer<typeof SearchPlanfixTaskOutputSchema>> {
    try {
      const result = await planfixRequest(`task/list`, {
        ...postBody,
        filters: [...filtersDefault, ...filtersArr]
      }) as {
        tasks?: Array<{
          id: number;
          assignees?: { users: Assignee[] };
          description?: string;
        }>;
      };
      if (result.tasks?.[0]) {
        const task = result.tasks[0];
        return {
          taskId: task.id,
          assignees: task.assignees,
          description: task.description,
          found: true
        };
      }
      return {
        taskId: 0,
        found: false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
return {
        taskId: 0,
        error: `Error searching for tasks: ${errorMessage}`,
        found: false
      };
    }
  }

  try {
    if (clientId) {
      const result = await searchWithFilter([filters.byClient]);
      taskId = result.taskId;
      assignees = result.assignees;
    }
    if (!taskId && taskName) {
      const result = await searchWithFilter([filters.byName/*, filters.byLastDays*/]);
      taskId = result.taskId;
      assignees = result.assignees;
    }
    const url = getTaskUrl(taskId);
    return {
      taskId,
      assignees,
      url,
      found: !!taskId
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      taskId: 0,
      assignees: undefined,
      url: undefined,
      error: `Error searching for tasks: ${errorMessage}`,
      found: false
    };
  }
}

async function handler(
  args?: Record<string, unknown>
): Promise<z.infer<typeof SearchPlanfixTaskOutputSchema>> {
  const parsedArgs = SearchPlanfixTaskInputSchema.parse(args);
  return await searchPlanfixTask(parsedArgs);
}

export const planfixSearchTaskTool = getToolWithHandler({
  name: 'planfix_search_task',
  description: 'Search for a task in Planfix by name or client ID',
  inputSchema: SearchPlanfixTaskInputSchema,
  outputSchema: SearchPlanfixTaskOutputSchema,
  handler,
});

export default planfixSearchTaskTool;
