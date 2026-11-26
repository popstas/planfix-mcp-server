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

interface FoundTask {
  id: number;
  name?: string;
  assignees?: { users: Assignee[] };
  description?: string;
  status?: { id: number; name?: string };
  customFieldData?: Array<{ field?: { id?: number }; value?: unknown }>;
}

/** True when the task's client field holds exactly `contact:<clientId>`. */
function isTaskOfClient(task: FoundTask, clientId: number): boolean {
  return Boolean(
    task.customFieldData?.some(
      (f) =>
        f.field?.id === PLANFIX_FIELD_IDS.client &&
        (f.value as { id?: unknown } | undefined)?.id === `contact:${clientId}`,
    ),
  );
}

/**
 * Lead statuses that end the lead: "Не клиент или дубль", "Клиент ничего не
 * купил", "Завершенная", "Отложенная". A lead in any other status is active and
 * new requests from the client belong in it.
 */
export const LEAD_CLOSED_STATUS_IDS: ReadonlySet<number> = new Set([
  255, 245, 3, 4,
]);

/**
 * Lead funnel, least to most advanced (Planfix object "Lead", template 634921).
 * Statuses missing here (new ones added in Planfix) rank below "Черновик".
 */
export const LEAD_FUNNEL_STATUS_IDS: readonly number[] = [
  0, // Черновик
  1, // Новая
  261, // Недозвон
  263, // Первый звонок
  216, // Принято в работу
  214, // Клиент отвечает
  205, // Коммерческое предложение
  199, // Клиент принимает решение
  203, // Заказ отправлен на выполнение
  202, // Услуги оказаны. На связи
];

function funnelRank(task: FoundTask): number {
  const statusId = task.status?.id;
  return statusId === undefined ? -1 : LEAD_FUNNEL_STATUS_IDS.indexOf(statusId);
}

/**
 * Picks the lead a new request should go to: among active leads the most
 * advanced one in the funnel, ties going to the oldest (smallest id). With no
 * active lead it falls back to the last task in the list, as before.
 */
export function pickLeadTask(tasks: FoundTask[]): FoundTask | undefined {
  const active = tasks.filter(
    (task) =>
      task.status?.id === undefined ||
      !LEAD_CLOSED_STATUS_IDS.has(task.status.id),
  );
  if (!active.length) return tasks[tasks.length - 1];
  return active.reduce((best, task) => {
    const diff = funnelRank(task) - funnelRank(best);
    if (diff > 0) return task;
    if (diff === 0 && task.id < best.id) return task;
    return best;
  });
}

export async function searchPlanfixTask({
  taskTitle,
  clientId,
  leadId,
  templateId,
  exactTitle = false,
}: {
  taskTitle?: string;
  clientId?: number;
  leadId?: number;
  templateId?: number;
  /** Title search (a substring match in Planfix) keeps only exact names. */
  exactTitle?: boolean;
}): Promise<z.infer<typeof SearchPlanfixTaskOutputSchema>> {
  let taskId: number | undefined = undefined;
  let assignees: { users: Assignee[] } | undefined;
  let totalTasks = 0;

  const postBody = {
    offset: 0,
    pageSize: 100,
    filters: [],
    // The client field is read back to verify client-filter results
    fields: [
      "id,name,description,template,assignees,status",
      ...(PLANFIX_FIELD_IDS.client ? [PLANFIX_FIELD_IDS.client] : []),
    ].join(","),
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
    {
      preferActiveLead = false,
      keep,
    }: {
      preferActiveLead?: boolean;
      /** Drops the tasks Planfix returned that do not really match. */
      keep?: (task: FoundTask) => boolean;
    } = {},
  ): Promise<z.infer<typeof SearchPlanfixTaskOutputSchema>> {
    try {
      const result = (await planfixRequest({
        path: `task/list`,
        body: {
          ...postBody,
          filters: [...filtersDefault, ...filtersArr],
        },
      })) as { tasks?: FoundTask[] };
      const tasks = keep
        ? (result.tasks ?? []).filter(keep)
        : (result.tasks ?? []);
      const totalTasks = tasks.length;
      if (tasks.length > 0) {
        const task = preferActiveLead
          ? pickLeadTask(tasks)!
          : tasks[tasks.length - 1];
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
    // A failed request is not a miss: report it instead of falling through to
    // the next filter, so callers don't create a duplicate lead over it.
    const steps: Array<[boolean, () => ReturnType<typeof searchWithFilter>]> = [
      [Boolean(leadId), () => searchWithFilter([filters.byLeadId])],
      [
        Boolean(clientId),
        () =>
          searchWithFilter([filters.byClient], {
            // Planfix silently ignores the client filter for a nonexistent
            // contact id and returns unrelated tasks (100 leads for
            // contact:99999999), so keep only that contact's tasks.
            keep: (task) => isTaskOfClient(task, clientId!),
            // Status ids below are the Lead template's; other templates keep
            // the old "last task" pick.
            preferActiveLead:
              templateId !== undefined &&
              templateId === Number(process.env.PLANFIX_LEAD_TEMPLATE_ID),
          }),
      ],
      [
        Boolean(taskTitle),
        () =>
          searchWithFilter([filters.byName], {
            // Filter 8 matches a substring ("Талакина" found the lead)
            keep: exactTitle
              ? (task) => task.name?.trim() === taskTitle?.trim()
              : undefined,
          }),
      ],
      [customFilters.length > 0, () => searchWithFilter(customFilters)],
    ];
    for (const [enabled, search] of steps) {
      if (!enabled || taskId) continue;
      const result = await search();
      if (result.error) {
        return {
          taskId: 0,
          url: "",
          error: result.error,
          found: false,
          totalTasks: 0,
        };
      }
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
