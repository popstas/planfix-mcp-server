import {z} from 'zod';
import {getToolWithHandler, getUserUrl, log, planfixRequest} from '../helpers.js';

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

    const result = await planfixRequest('user/list', postBody) as {
      users?: Array<{
        id: number;
        name?: string;
        lastname?: string;
      }>;
    };
    if (result.users?.[0]?.id) {
      const manager = result.users[0];
      const managerId = manager.id;
      const url = getUserUrl(managerId);
      return {
        managerId,
        url,
        firstName: manager.name,
        lastName: manager.lastname
      };
    }

    return {
      managerId: 0,
      error: `No manager found with email: ${email}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    log(`[searchManager] Error: ${errorMessage}`);
    return {
      managerId: 0,
      error: `An error occurred while searching for the manager: ${errorMessage}`
    };
  }
}

export async function handler(
  args?: Record<string, unknown>
): Promise<z.infer<typeof SearchManagerOutputSchema>> {
  const parsedArgs = SearchManagerInputSchema.parse(args);
  return await searchManager(parsedArgs);
}

export const planfixSearchManagerTool = getToolWithHandler({
  name: 'planfix_search_manager',
  description: 'Search for a manager in Planfix by email',
  inputSchema: SearchManagerInputSchema,
  outputSchema: SearchManagerOutputSchema,
  handler,
});

export default planfixSearchManagerTool;
