import { z } from "zod";
import { planfixSearchContact } from "./planfix_search_contact.js";
import { searchPlanfixTask } from "./planfix_search_task.js";
import { planfixSearchCompany } from "./planfix_search_company.js";
import { UserDataInputSchema, UsersListType } from "../types.js";
import { customFieldsConfig } from "../customFieldsConfig.js";
import { extendSchemaWithCustomFields } from "../lib/extendSchemaWithCustomFields.js";
import {
  getContactUrl,
  getTaskUrl,
  getToolWithHandler,
  log,
} from "../helpers.js";

const TEMPLATE_ID = Number(process.env.PLANFIX_LEAD_TEMPLATE_ID);

export const SearchLeadTaskInputSchema = extendSchemaWithCustomFields(
  UserDataInputSchema.extend({
    clientId: z.number().optional(),
  }),
  customFieldsConfig.contactFields,
);

export const SearchLeadTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string().optional(),
  clientId: z.number(),
  clientUrl: z.string().optional(),
  assignees: z.any().optional(), // Made more flexible to handle Planfix response
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  agencyId: z.number().optional(),
  totalTasks: z.number().optional(),
  found: z.boolean(),
});

/**
 * Searches for a lead task in Planfix based on user data.
 * @param userData - The user data to search for (name, phone, email, telegram, company)
 * @returns Object containing task and contact information if found
 */
export async function searchLeadTask(
  userData: z.infer<typeof SearchLeadTaskInputSchema>,
): Promise<z.infer<typeof SearchLeadTaskOutputSchema>> {
  log(
    `[searchLeadTask] Searching for lead task by userData: ${JSON.stringify(userData)}`,
  );

  try {
    // 1. Determine client ID
    const shouldSearchContact = userData.clientId === undefined;
    const contactResult = shouldSearchContact
      ? await planfixSearchContact(userData)
      : {
          contactId: userData.clientId ?? 0,
          firstName: undefined,
          lastName: undefined,
          found: Boolean(userData.clientId),
        };
    const clientId = contactResult.contactId || 0;
    log(`[searchLeadTask] Contact found: ${clientId}`);

    let taskId = 0;
    let assignees: UsersListType = { users: [] };
    let totalTasks = 0;

    // 2. If contact found, search for task by clientId
    if (clientId > 0) {
      const result = await searchPlanfixTask({
        clientId,
        templateId: TEMPLATE_ID,
      });
      if (result.assignees && Array.isArray(result.assignees.users)) {
        assignees = result.assignees;
      }
      taskId = result.taskId || 0;
      totalTasks = result.totalTasks ?? totalTasks;
      log(`[searchLeadTask] Task found: ${taskId}`);
    }

    // 3. If company provided, search for company
    let agencyId: number | undefined;
    if (userData.company) {
      const companyResult = await planfixSearchCompany({
        name: userData.company,
      });
      if ("contactId" in companyResult && companyResult.contactId) {
        agencyId = companyResult.contactId;
      }
    }

    // 4. Prepare response
    const { firstName, lastName } = contactResult;
    const url = getTaskUrl(taskId);
    const clientUrl = getContactUrl(clientId);

    return {
      taskId,
      clientId,
      url,
      clientUrl,
      assignees,
      firstName,
      lastName,
      agencyId,
      totalTasks,
      found: taskId > 0,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[searchLeadTask] Error: ${errorMessage}`);
    return {
      taskId: 0,
      clientId: 0,
      url: "",
      clientUrl: "",
      assignees: undefined,
      agencyId: undefined,
      firstName: undefined,
      lastName: undefined,
      totalTasks: 0,
      found: false,
    };
  }
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof SearchLeadTaskOutputSchema>> {
  const parsedArgs = SearchLeadTaskInputSchema.parse(args);
  return await searchLeadTask(parsedArgs);
}

export const planfixSearchLeadTaskTool = getToolWithHandler({
  name: "planfix_search_lead_task",
  description:
    "Search Planfix task by user data. Use name in 2 languages: Russian and English.",
  inputSchema: SearchLeadTaskInputSchema,
  outputSchema: SearchLeadTaskOutputSchema,
  handler,
});

export default planfixSearchLeadTaskTool;
