import { z } from "zod";
import { getToolWithHandler, log } from "../helpers.js";
import {
  createSellTaskIds,
  CreateSellTaskOutputSchema,
} from "./planfix_create_sell_task_ids.js";
import { searchLeadTask } from "./planfix_search_lead_task.js";
import { planfixSearchCompany } from "./planfix_search_company.js";
import type { UsersListType } from "../types.js";

export const CreateSellTaskInputSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  agency: z.string().optional(),
  email: z.string().min(1, "Email is required"),
  contactName: z.string().optional(),
  employeeName: z.string().optional(),
  telegram: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  project: z.string().optional(),
});

function extractAssigneeIds(assignees?: UsersListType): number[] | undefined {
  if (!assignees?.users?.length) {
    return undefined;
  }

  const ids = assignees.users
    .map((user) => {
      if (!user?.id) return undefined;
      const match = user.id.match(/(?:user:)?(\d+)/);
      if (!match) return undefined;
      const parsed = Number(match[1]);
      return Number.isFinite(parsed) ? parsed : undefined;
    })
    .filter((value): value is number => typeof value === "number");

  return ids.length ? ids : undefined;
}

export async function createSellTask(
  args: z.infer<typeof CreateSellTaskInputSchema>,
): Promise<z.infer<typeof CreateSellTaskOutputSchema>> {
  const {
    name,
    agency,
    email,
    contactName,
    employeeName,
    telegram,
    description,
    project,
  } = args;

  const resolvedContactName = contactName ?? employeeName;

  const searchResult = await searchLeadTask({
    name: resolvedContactName,
    email,
    telegram,
    company: agency,
  });

  const {
    clientId,
    taskId: leadTaskId,
    agencyId: initialAgencyId,
    assignees,
  } = searchResult;
  let resolvedAgencyId = initialAgencyId;

  if (!clientId) {
    throw new Error(
      "Unable to find a Planfix contact for the provided email/telegram",
    );
  }

  if (!resolvedAgencyId && agency) {
    try {
      const companyResult = await planfixSearchCompany({ name: agency });
      if ("contactId" in companyResult && companyResult.contactId) {
        resolvedAgencyId = companyResult.contactId;
      }
    } catch (error) {
      log(
        `[createSellTask] Failed to resolve agency '${agency}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const assigneeIds = extractAssigneeIds(assignees);

  return createSellTaskIds({
    clientId,
    leadTaskId: leadTaskId || undefined,
    agencyId: resolvedAgencyId,
    assignees: assigneeIds,
    name,
    description,
    project,
  });
}

async function handler(args?: Record<string, unknown>) {
  const parsedArgs = CreateSellTaskInputSchema.parse(args);
  return createSellTask(parsedArgs);
}

export const planfixCreateSellTaskTool = getToolWithHandler({
  name: "planfix_create_sell_task",
  description:
    "Create a sell task in Planfix using textual data for agency and contact",
  inputSchema: CreateSellTaskInputSchema,
  outputSchema: CreateSellTaskOutputSchema,
  handler,
});

export default planfixCreateSellTaskTool;
