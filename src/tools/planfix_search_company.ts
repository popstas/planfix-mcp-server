import { z } from "zod";
import {
  getContactUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";

interface SearchFilter {
  type: number;
  operator: string;
  value: unknown;
}

export const PlanfixSearchCompanyInputSchema = z.object({
  name: z.string().optional(),
});

export const PlanfixSearchCompanyOutputSchema = z.object({
  contactId: z.number().optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  error: z.string().optional(),
});

export async function planfixSearchCompany({
  name,
}: {
  name?: string;
}): Promise<
  z.infer<typeof PlanfixSearchCompanyOutputSchema> | { error: string }
> {
  let contactId: number | null = null;
  let companyName: string | undefined = undefined;
  const postBody = {
    offset: 0,
    pageSize: 100,
    isCompany: true,
    filters: [
      { type: 4006, operator: "equal", value: true }, // isCompany: true
    ],
    fields: "id,name",
  };

  const filters: Record<string, SearchFilter> = {
    byName: {
      type: 4001,
      operator: "equal",
      value: name,
    },
  };

  async function searchWithFilter(
    filter: SearchFilter,
  ): Promise<{ contactId: number; name?: string; error?: string }> {
    const currentFilters = [...postBody.filters, filter];
    try {
      const result = await planfixRequest<{
        contacts: Array<{ id: number; name: string }>;
      }>({
        path: `contact/list`,
        body: {
          ...postBody,
          filters: currentFilters,
        },
      });

      if (result.contacts?.length > 0) {
        contactId = result.contacts[0].id;
        companyName = result.contacts[0].name;
      }
      return { contactId: contactId || 0, name: companyName };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      log(`[planfixSearchCompany] Error: ${errorMessage}`);
      return { contactId: 0, error: errorMessage };
    }
  }

  try {
    let searchResult:
      | { contactId: number; name?: string; error?: string }
      | undefined;
    if (!contactId && name) {
      searchResult = await searchWithFilter(filters.byName);
      contactId = searchResult.contactId;
      companyName = searchResult.name;
    }
    contactId = contactId || 0;
    const url = getContactUrl(contactId);
    return {
      contactId,
      url,
      name: companyName,
      error: searchResult?.error,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[planfixSearchCompany] Error: ${errorMessage}`);
    return { contactId: 0, error: errorMessage };
  }
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof PlanfixSearchCompanyOutputSchema>> {
  const parsedArgs = PlanfixSearchCompanyInputSchema.parse(args);
  return await planfixSearchCompany(parsedArgs);
}

const planfixSearchCompanyTool = getToolWithHandler({
  name: "planfix_search_company",
  description: "Search for a company in Planfix by name",
  inputSchema: PlanfixSearchCompanyInputSchema,
  outputSchema: PlanfixSearchCompanyOutputSchema,
  handler,
});

export default planfixSearchCompanyTool;
