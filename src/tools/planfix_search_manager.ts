import { z } from 'zod';
import { planfixRequest, getUserUrl, log, getToolWithHandler } from '../helpers.js';

export const SearchManagerInputSchema = z.object({
  email: z.string(),
});

export const SearchManagerOutputSchema = z.object({
  managerId: z.number(),
  url: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Search for a manager in Planfix by email
 * @param email - The email address to search for
 * @returns Promise with the manager's ID, URL, and name if found
 */
export async function searchManager({ 
  email 
}: z.infer<typeof SearchManagerInputSchema>): Promise<z.infer<typeof SearchManagerOutputSchema>> {
  try {
    const postBody = {
      offset: 0,
      pageSize: 100,
      fields: "id,name,midname,lastname,email",
      filters: [
        {
          type: 9003, // Filter by email
          operator: "equal",
          value: email,
        },
      ],
    };

    const result = await planfixRequest(`user/list`, postBody);
    if (result.users && result.users.length > 0) {
      const managerId = result.users[0].id;
      const firstName = result.users[0].name;
      const lastName = result.users[0].lastname;
      const url = getUserUrl(managerId);
      return { managerId, url, firstName, lastName };
    } else {
      return { 
        managerId: 0, 
        url: undefined, 
        error: `No manager found with email: ${email}`
      };
    }
  } catch (error: any) {
    log(`[searchManager] Error: ${error.message}`);
    return { 
      managerId: 0, 
      url: undefined, 
      error: error.message || 'An error occurred while searching for the manager' 
    };
  }
}

export function handler(args?: Record<string, unknown>) {
  const parsedArgs = SearchManagerInputSchema.parse(args);
  return searchManager(parsedArgs);
}

export const planfixSearchManagerTool = getToolWithHandler({
  name: 'planfix_search_manager',
  description: 'Search for a manager in Planfix by email',
  inputSchema: SearchManagerInputSchema,
  outputSchema: SearchManagerOutputSchema,
  handler,
});

export default planfixSearchManagerTool;
