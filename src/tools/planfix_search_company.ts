import { z } from 'zod';
import { planfixRequest, getContactUrl, getToolWithHandler } from '../helpers.js';

export const PlanfixSearchCompanyInputSchema = z.object({
  name: z.string().optional(),
});

export const PlanfixSearchCompanyOutputSchema = z.object({
  contactId: z.number().optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  error: z.string().optional(),
});

export async function planfixSearchCompany({ name }: { name?: string }): Promise<z.infer<typeof PlanfixSearchCompanyOutputSchema> | { error: string }> {
  let contactId: number | null = null;
  let companyName: string | undefined = undefined;
  const postBody: any = {
    offset: 0,
    pageSize: 100,
    isCompany: true,
    filters: [
      { type: 4006, operator: 'equal', value: true } // isCompany: true
    ],
    fields: 'id,name',
  };

  const filters = {
    byName: {
      type: 4001,
      operator: 'equal',
      value: name,
    },
  };

  async function searchWithFilter(filter: any, label: string): Promise<{ contactId: number; name?: string; error?: string }> {
    const currentFilters = [...postBody.filters, filter];
    try {
      const result = await planfixRequest(`contact/list`, {
        ...postBody,
        filters: currentFilters
      });

      if (result.contacts?.length > 0) {
        contactId = result.contacts[0].id;
        companyName = result.contacts[0].name;
      }
      return { contactId: contactId || 0, name: companyName };
    } catch (error: any) {
      return { contactId: 0, error: error.message };
    }
  }

  try {
    let result;
    if (!contactId && name) {
      result = await searchWithFilter(filters.byName, 'name');
      contactId = result.contactId;
    }
    contactId = contactId || 0;
    const url = getContactUrl(contactId);
    return { 
      contactId, 
      url, 
      name: companyName || result?.name,
      error: result?.error
    };
  } catch (error: any) {
    console.error('Error searching for company:', error.message);
    return { contactId: 0, url: undefined, error: error.message };
  }
}

function handler(args?: Record<string, unknown>): Promise<z.infer<typeof PlanfixSearchCompanyOutputSchema>> {
  args = PlanfixSearchCompanyInputSchema.parse(args);
  return planfixSearchCompany(args);
}

const planfixSearchCompanyTool = getToolWithHandler({
  name: 'planfix_search_company',
  description: 'Search for a company in Planfix by name',
  inputSchema: PlanfixSearchCompanyInputSchema,
  outputSchema: PlanfixSearchCompanyOutputSchema,
  handler,
});

export default planfixSearchCompanyTool;
