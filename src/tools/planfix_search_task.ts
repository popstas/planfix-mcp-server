import { z } from "zod";
import { PLANFIX_FIELD_IDS } from "../config.js";
import { getTaskUrl, getToolWithHandler, planfixRequest } from "../helpers.js";
import { customFieldsConfig } from "../customFieldsConfig.js";
import { extendSchemaWithCustomFields } from "../lib/extendSchemaWithCustomFields.js";
import {
  extendFiltersWithCustomFields,
  type PlanfixFilter,
} from "../lib/extendFiltersWithCustomFields.js";

const SearchPlanfixTaskInputSchemaBase = z.object({
  taskTitle: z.string().optional(),
  clientId: z.number().optional(),
  leadId: z.number().optional(),
  templateId: z.number().optional(),
});

export const SearchPlanfixTaskInputSchema = extendSchemaWithCustomFields(
  SearchPlanfixTaskInputSchemaBase,
  customFieldsConfig.leadTaskFields,
);

export const SearchPlanfixTaskOutputSchema = z.object({
  taskId: z.number().optional(),
  assignees: z.any().optional(), // Made more flexible to handle Planfix response
  description: z.string().optional(),
  totalTasks: z.number().optional(),
  url: z.string().optional(),
  error: z.string().optional(),
  found: z.boolean(),
});

interface Assignee {
  id: string;
  name?: string;
}

export async function searchPlanfixTask({
  taskTitle,
  clientId,
  leadId,
  templateId,
}: {
  taskTitle?: string;
  clientId?: number;
  leadId?: number;
  templateId?: number;
}): Promise<z.infer<typeof SearchPlanfixTaskOutputSchema>> {
  let taskId: number | undefined = undefined;
  let assignees: { users: Assignee[] } | undefined;
  let totalTasks = 0;

  const postBody = {
    offset: 0,
    pageSize: 100,
    filters: [],
    fields: "id,name,description,template,assignees",
  };

  const filtersDefault: PlanfixFilter[] = [];

  if (templateId) {
    filtersDefault.push({
      type: 51, // filter by template
      operator: "equal",
      value: templateId,
    });
  }

  const filters = {
    byClient: {
      type: 108,
      field: PLANFIX_FIELD_IDS.client,
      operator: "equal",
      value: `contact:${clientId}`,
    },
    byLeadId: {
      type: 102,
      field: PLANFIX_FIELD_IDS.leadId,
      operator: "equal",
      value: leadId,
    },
    byName: {
      type: 8,
      operator: "equal",
      value: taskTitle,
    },
  };

  const customFilters: PlanfixFilter[] = [];
  extendFiltersWithCustomFields(
    customFilters,
    { taskTitle, clientId, leadId },
    customFieldsConfig.leadTaskFields,
    "task",
  );

  async function searchWithFilter(
    filtersArr: PlanfixFilter[],
  ): Promise<z.infer<typeof SearchPlanfixTaskOutputSchema>> {
    try {
      const result = (await planfixRequest({
        path: `task/list`,
        body: {
          ...postBody,
          filters: [...filtersDefault, ...filtersArr],
        },
      })) as {
        tasks?: Array<{
          id: number;
          assignees?: { users: Assignee[] };
          description?: string;
        }>;
      };
      const totalTasks = result.tasks?.length ?? 0;
      if (result.tasks?.[0]) {
        const task = result.tasks[0];
        return {
          taskId: task.id,
          assignees: task.assignees,
          description: task.description,
          found: true,
          totalTasks,
        };
      }
      return {
        taskId: 0,
        found: false,
        totalTasks,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        taskId: 0,
        error: `Error searching for tasks: ${errorMessage}`,
        found: false,
        totalTasks: 0,
      };
    }
  }

  try {
    if (leadId) {
      const result = await searchWithFilter([filters.byLeadId]);
      taskId = result.taskId;
      assignees = result.assignees;
      totalTasks = result.totalTasks ?? totalTasks;
    }
    if (clientId && !taskId) {
      const result = await searchWithFilter([filters.byClient]);
      taskId = result.taskId;
      assignees = result.assignees;
      totalTasks = result.totalTasks ?? totalTasks;
    }
    if (!taskId && taskTitle) {
      const result = await searchWithFilter([
        filters.byName /*, filters.byLastDays*/,
      ]);
      taskId = result.taskId;
      assignees = result.assignees;
      totalTasks = result.totalTasks ?? totalTasks;
    }
    if (!taskId && customFilters.length) {
      const result = await searchWithFilter(customFilters);
      taskId = result.taskId;
      assignees = result.assignees;
      totalTasks = result.totalTasks ?? totalTasks;
    }
    const url = getTaskUrl(taskId);
    return {
      taskId,
      assignees,
      url,
      found: !!taskId,
      totalTasks,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      taskId: 0,
      assignees: undefined,
      url: undefined,
      error: `Error searching for tasks: ${errorMessage}`,
      found: false,
      totalTasks: 0,
    };
  }
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof SearchPlanfixTaskOutputSchema>> {
  const parsedArgs = SearchPlanfixTaskInputSchema.parse(args);
  return await searchPlanfixTask(parsedArgs);
}

export const planfixSearchTaskTool = getToolWithHandler({
  name: "planfix_search_task",
  description: "Search for a task in Planfix by title or client ID",
  inputSchema: SearchPlanfixTaskInputSchema,
  outputSchema: SearchPlanfixTaskOutputSchema,
  handler,
});

export default planfixSearchTaskTool;
