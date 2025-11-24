import { z } from "zod";
import {
  getTaskUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";

export const GetChildTasksInputSchema = z.object({
  parentTaskId: z.number(),
  recursive: z.boolean().optional(),
});

export const ChildTaskSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  assignees: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        isActive: z.boolean(),
      }),
    )
    .optional(),
  url: z.string().optional(),
  parent_task_id: z.number(),
});

export const GetChildTasksOutputSchema = z.object({
  tasks: z.array(ChildTaskSchema),
  totalCount: z.number(),
  error: z.string().optional(),
});

export async function getChildTasks({
  parentTaskId,
  recursive = false,
}: z.infer<typeof GetChildTasksInputSchema>): Promise<
  z.infer<typeof GetChildTasksOutputSchema>
> {
  try {
    const { tasks, totalCount } = await fetchChildTasks(parentTaskId);

    if (!recursive) {
      return { tasks, totalCount };
    }

    const queue = [...tasks];
    while (queue.length) {
      const parent = queue.shift();
      if (!parent) {
        continue;
      }

      const nestedTasks = await fetchChildTasks(parent.id);
      tasks.push(...nestedTasks.tasks);
      queue.push(...nestedTasks.tasks);
    }

    return {
      tasks,
      totalCount: tasks.length,
    };
  } catch (error) {
    log(
      "Exception when getting child tasks: " +
        (error instanceof Error ? error.message : "Unknown error"),
    );
    return {
      tasks: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof GetChildTasksOutputSchema>> {
  const parsedArgs = GetChildTasksInputSchema.parse(args);
  return await getChildTasks(parsedArgs);
}

async function fetchChildTasks(parentTaskId: number) {
  const result = await planfixRequest({
    path: `task/list`,
    body: {
      parent: { id: parentTaskId },
      pageSize: 100,
      offset: 0,
      fields: ["id", "name", "description", "assignees", "status"].join(","),
      filters: [
        {
          type: 73,
          operator: "eq",
          value: parentTaskId,
        },
      ],
    },
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

  const tasks =
    data.tasks?.map((task) => ({
      id: task.id,
      name: task.name,
      url: getTaskUrl(task.id),
      description: task.description,
      assignees: task.assignees,
      status: task.status.name,
      parent_task_id: parentTaskId,
    })) || [];

  return { tasks, totalCount: data.pagination?.count || 0 };
}

const planfixGetChildTasksTool = getToolWithHandler({
  name: "planfix_get_child_tasks",
  description: "Get all child tasks of a specific parent task in Planfix",
  inputSchema: GetChildTasksInputSchema,
  outputSchema: GetChildTasksOutputSchema,
  handler,
});

export default planfixGetChildTasksTool;
