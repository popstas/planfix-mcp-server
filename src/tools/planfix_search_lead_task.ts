import { z } from 'zod';
import { planfixSearchContact } from './planfix_search_contact.js';
import { searchPlanfixTask } from './planfix_search_task.js';
import { planfixSearchCompany } from './planfix_search_company.js';
import { UserDataInputSchema } from '../types.js';
import { getTaskUrl, getContactUrl, getToolWithHandler } from '../helpers.js';

export const SearchLeadTaskInputSchema = UserDataInputSchema;

export const SearchLeadTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string().optional(),
  clientId: z.number(),
  clientUrl: z.string().optional(),
  assignees: z.any().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  agencyId: z.number().optional(),
});

/**
 * Searches for a lead task in Planfix based on user data.
 * @param userData - The user data to search for (name, phone, email, telegram, company)
 * @returns Object containing task and contact information if found
 */
export async function searchLeadTask(
  userData: z.infer<typeof SearchLeadTaskInputSchema>
): Promise<z.infer<typeof SearchLeadTaskOutputSchema>> {
  console.log(`[searchLeadTask] Searching for lead task by userData: ${JSON.stringify(userData)}`);
  
  try {
    // 1. Search for contact
    const contactResult = await planfixSearchContact(userData);
    const clientId = contactResult.contactId;
    console.log(`[searchLeadTask] Contact found: ${clientId}`);
    
    let taskId = 0;
    let assignees: any[] = [];
    
    // 2. If contact found, search for task by clientId
    if (clientId) {
      const result = await searchPlanfixTask({ clientId });
      assignees = result.assignees || [];
      taskId = result.taskId || 0;
      console.log(`[searchLeadTask] Task found: ${taskId}`);
    }

    // 3. If company provided, search for company
    let agencyId: number | undefined;
    if (userData.company) {
      const companyResult = await planfixSearchCompany({ name: userData.company });
      if ('contactId' in companyResult) {
        agencyId = companyResult.contactId;
      }
    }

    // 4. Prepare response
    const firstName = contactResult.firstName;
    const lastName = contactResult.lastName;
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
      agencyId 
    };
  } catch (error: any) {
    console.error('[searchLeadTask] Error:', error.message);
    return { 
      taskId: 0, 
      clientId: 0, 
      url: '', 
      clientUrl: '', 
      assignees: [], 
      agencyId: undefined,
      firstName: undefined,
      lastName: undefined
    };
  }
}

function handler(args?: Record<string, unknown>): Promise<z.infer<typeof SearchLeadTaskOutputSchema>> {
  args = SearchLeadTaskInputSchema.parse(args);
  return searchLeadTask(args);
}

export const planfixSearchLeadTaskTool = getToolWithHandler({
  name: "planfix_search_lead_task",
  description: "Search Planfix task by name and clientId.",
  inputSchema: SearchLeadTaskInputSchema,
  outputSchema: SearchLeadTaskOutputSchema,
  handler,
});

export default planfixSearchLeadTaskTool;
