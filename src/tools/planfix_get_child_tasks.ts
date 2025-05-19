import { z } from 'zod';
import { planfixRequest, getTaskUrl, getToolWithHandler } from '../helpers.js';

export const GetChildTasksInputSchema = z.object({
  parentTaskId: z.number(),
});

export const ChildTaskSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  assignees: z.array(z.object({
    id: z.number(),
    name: z.string(),
    isActive: z.boolean(),
  })).optional(),
  url: z.string().optional(),
});

export const GetChildTasksOutputSchema = z.object({
  tasks: z.array(ChildTaskSchema),
  totalCount: z.number(),
  error: z.string().optional(),
});

export async function getChildTasks({ parentTaskId }: z.infer<typeof GetChildTasksInputSchema>): Promise<z.infer<typeof GetChildTasksOutputSchema>> {
  try {
    const result = await planfixRequest(`task/list`, {
      parent: { id: parentTaskId },
      pageSize: 100,
      offset: 0,
      fields: [
        'id',
        'name',
        'description',
        'assignees',
        'status',
      ].join(','),
      filters: [
        {
          type: 73,
          operator: "eq",
          value: parentTaskId
        }
      ],
    });

    const data = result as {
      tasks?: Array<{
        id: number;
        name: string;
        description?: string;
        status: {
          id: number;
          name: string;
          isActive: boolean;
        };
        assignees: {
          id: number;
          name: string;
          isActive: boolean;
        }[];
      }>;
      pagination?: {
        count: number;
        pageNumber: number;
        pageSize: number;
      };
    };
    
    const tasks = data.tasks?.map(task => ({
      id: task.id,
      name: task.name,
      url: getTaskUrl(task.id),
      description: task.description,
      assignees: task.assignees,
      status: task.status.name,
    })) || [];

    return {
      tasks,
      totalCount: data.pagination?.count || 0,
    };
  } catch (error) {
    console.error('Exception when getting child tasks:', error);
    return {
      tasks: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function handler(args?: Record<string, unknown>): Promise<z.infer<typeof GetChildTasksOutputSchema>> {
  const parsedArgs = GetChildTasksInputSchema.parse(args);
  return getChildTasks(parsedArgs);
}

const planfixGetChildTasksTool = getToolWithHandler({
  name: 'planfix_get_child_tasks',
  description: 'Get all child tasks of a specific parent task in Planfix',
  inputSchema: GetChildTasksInputSchema,
  outputSchema: GetChildTasksOutputSchema,
  handler,
});

export default planfixGetChildTasksTool;
