import { z } from 'zod';
import { PLANFIX_FIELD_IDS } from '../config.js';
import { planfixRequest, getContactUrl, getToolWithHandler } from '../helpers.js';

export const PlanfixSearchContactInputSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  telegram: z.string().optional(),
});

export const PlanfixSearchContactOutputSchema = z.object({
  contactId: z.number(),
  url: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

/**
 * Search for a contact in Planfix by name, phone, email, or telegram.
 * This is a placeholder implementation that should be replaced with actual Planfix API calls.
 */
export async function planfixSearchContact({
    name,
    phone,
    email,
    telegram
  }: z.infer<typeof PlanfixSearchContactInputSchema>): Promise<z.infer<typeof PlanfixSearchContactOutputSchema>> {
  // console.log('Searching Planfix contact...');
  let contactId: number | null = null;
  let firstName: string | undefined = undefined;
  let lastName: string | undefined = undefined;
  const postBody: any = {
    offset: 0,
    pageSize: 100,
    filters: [],
    fields: `id,name,midname,lastname,email,phone,description,group,${PLANFIX_FIELD_IDS.telegram}`,
  };

  const filters = {
    byName: {
      type: 4001,
      operator: 'equal',
      value: name,
    },
    byPhone: {
      type: 4003,
      operator: 'equal',
      value: phone,
    },
    byEmail: {
      type: 4026,
      operator: 'equal',
      value: email,
    },
    byTelegram: {
      type: 4101,
      field: PLANFIX_FIELD_IDS.telegram,
      operator: 'have',
      value: telegram?.replace(/^@/, ''),
    },
  };

  async function searchWithFilter(filter: any, label: string): Promise<{ contactId: number; firstName?: string; lastName?: string; error?: string }> {
    postBody.filters = [filter];
    try {
      const result = await planfixRequest(`contact/list`, {
        ...postBody,
        filters: postBody.filters
      });
      if (result.contacts && result.contacts.length > 0) {
        contactId = result.contacts[0].id;
        firstName = result.contacts[0].name;
        lastName = result.contacts[0].lastname;
      }
      contactId = contactId || 0;
      return { contactId, firstName, lastName };
    } catch (error: any) {
      // console.error('Error searching for contacts:', error.message);
      return { contactId: 0, error: error.message };
    }
  }
  try {
    let result;
    if (!contactId && email) {
      result = await searchWithFilter(filters.byEmail, 'email');
      contactId = result.contactId;
    }
    if (!contactId && phone) {
      result = await searchWithFilter(filters.byPhone, 'phone');
      contactId = result.contactId;
    }
    if (!contactId && name && name.includes(' ')) {
      result = await searchWithFilter(filters.byName, 'name');
      contactId = result.contactId;
    }
    if (!contactId && telegram) {
      result = await searchWithFilter(filters.byTelegram, 'telegram');
      contactId = result.contactId;
    }
    contactId = contactId || 0;
    const url = getContactUrl(contactId);
    const firstName = result?.firstName;
    const lastName = result?.lastName;
    return { contactId, url, firstName, lastName };
  } catch (error: any) {
    console.error('Error searching for contacts:', error.message);
    return { contactId: 0, url: undefined };
  }
}

function handler(args?: Record<string, unknown>): Promise<z.infer<typeof PlanfixSearchContactOutputSchema>> {
  args = PlanfixSearchContactInputSchema.parse(args);
  return planfixSearchContact(args);
}

export default getToolWithHandler({
  name: 'planfix_search_contact',
  description: 'Search for a contact in Planfix by name, phone, email, or telegram',
  inputSchema: PlanfixSearchContactInputSchema,
  outputSchema: PlanfixSearchContactOutputSchema,
  handler,
});
