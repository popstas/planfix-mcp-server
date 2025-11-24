import { z } from "zod";
import {
  getToolWithHandler,
  getUserUrl,
  log,
  planfixRequest,
} from "../helpers.js";
import { customFieldsConfig } from "../customFieldsConfig.js";
import { extendSchemaWithCustomFields } from "../lib/extendSchemaWithCustomFields.js";
import { extendFiltersWithCustomFields } from "../lib/extendFiltersWithCustomFields.js";

const SearchManagerInputSchemaBase = z.object({
  email: z.string(),
});

export const SearchManagerInputSchema = extendSchemaWithCustomFields(
  SearchManagerInputSchemaBase,
  customFieldsConfig.userFields,
);

const SearchManagerOutputSchemaBase = z.object({
  managerId: z.number(),
  url: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  error: z.string().optional(),
  found: z.boolean(),
});

export const SearchManagerOutputSchema = extendSchemaWithCustomFields(
  SearchManagerOutputSchemaBase,
  customFieldsConfig.userFields,
);

/**
 * Search for a manager in Planfix by email
 * @param email - The email address to search for
 * @returns Promise with the manager's ID, URL, and name if found
 */
export async function searchManager({
  email,
  ...args
}: z.infer<typeof SearchManagerInputSchema>): Promise<
  z.infer<typeof SearchManagerOutputSchema>
> {
  try {
    const customFilters: Array<{
      type: number;
      field?: number;
      operator: string;
      value?: unknown;
    }> = [];

    extendFiltersWithCustomFields(
      customFilters,
      args,
      customFieldsConfig.userFields,
      "user",
    );

    const postBody = {
      offset: 0,
      pageSize: 100,
      fields: "id,name,midname,lastname,email,customFieldData",
      filters: [
        {
          type: 9003, // Filter by email
          operator: "equal",
          value: email,
        },
        ...customFilters,
      ],
    };

    const result = (await planfixRequest({
      path: "user/list",
      body: postBody,
    })) as {
      users?: Array<{
        id: number;
        name?: string;
        lastname?: string;
        customFieldData?: Array<{
          field: { id: number };
          value?: unknown;
        }>;
      }>;
    };
    if (result.users?.[0]?.id) {
      const manager = result.users[0];
      const managerId = manager.id;
      const url = getUserUrl(managerId);
      const customFields: Record<string, unknown> = {};

      for (const field of customFieldsConfig.userFields) {
        const match = manager.customFieldData?.find(
          (cf) => cf.field?.id === Number(field.id),
        );
        if (match && match.value !== undefined) {
          customFields[field.argName] = match.value;
        }
      }

      return {
        managerId,
        url,
        firstName: manager.name,
        lastName: manager.lastname,
        found: true,
        ...customFields,
      };
    }

    return {
      managerId: 0,
      error: `No manager found with email: ${email}`,
      found: false,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    log(`[searchManager] Error: ${errorMessage}`);
    return {
      managerId: 0,
      error: `An error occurred while searching for the manager: ${errorMessage}`,
      found: false,
    };
  }
}

export async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof SearchManagerOutputSchema>> {
  const parsedArgs = SearchManagerInputSchema.parse(args);
  return await searchManager(parsedArgs);
}

export const planfixSearchManagerTool = getToolWithHandler({
  name: "planfix_search_manager",
  description: "Search for a manager in Planfix by email",
  inputSchema: SearchManagerInputSchema,
  outputSchema: SearchManagerOutputSchema,
  handler,
});

export default planfixSearchManagerTool;
