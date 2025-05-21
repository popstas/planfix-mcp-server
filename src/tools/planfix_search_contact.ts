import {z} from 'zod';
import {PLANFIX_FIELD_IDS} from '../config.js';
import {getContactUrl, getToolWithHandler, log, planfixRequest} from '../helpers.js';

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
  error: z.string().optional(),
  found: z.boolean(),
});

/**
 * Search for a contact in Planfix by name, phone, email, or telegram.
 * This is a placeholder implementation that should be replaced with actual Planfix API calls.
 */
export async function planfixSearchContact(
  {
    name,
    phone,
    email,
    telegram
  }: z.infer<typeof PlanfixSearchContactInputSchema>): Promise<z.infer<typeof PlanfixSearchContactOutputSchema>>{
  // console.log('Searching Planfix contact...');
  let contactId: number | null = null;
  const postBody = {
    offset: 0,
    pageSize: 100,
    filters: [],
    fields: `id,name,midname,lastname,email,phone,description,group,${PLANFIX_FIELD_IDS.telegram}`,
  };

  type FilterType = {
    type: number;
    operator: string;
    value?: string | number | boolean;
    field?: number;
  };

  const filters: Record<string, FilterType> = {
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

  async function searchWithFilter(filter: FilterType): Promise<z.infer<typeof PlanfixSearchContactOutputSchema>> {
    try {
      const result = await planfixRequest(
        'contact/list',
        {
          ...postBody,
          filters: [filter]
        }
      ) as { contacts?: Array<{ id: number; name?: string; lastname?: string }> };

      if (result.contacts?.[0]) {
        const contact = result.contacts[0];
        return {
          contactId: contact.id,
          firstName: contact.name,
          lastName: contact.lastname,
          found: true
        };
      }

return {
        contactId: 0,
        found: false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[planfixSearchContact] Error searching with filter: ${errorMessage}`);
      return {
        contactId: 0,
        error: errorMessage,
        found: false
      };
    }
  }

  try {
    let result: z.infer<typeof PlanfixSearchContactOutputSchema> | undefined;
    if (!contactId && email) {
      result = await searchWithFilter(filters.byEmail);
      contactId = result.contactId;
    }
    if (!contactId && phone) {
      result = await searchWithFilter(filters.byPhone);
      contactId = result.contactId;
    }
    if (!contactId && name && name.includes(' ')) {
      result = await searchWithFilter(filters.byName);
      contactId = result.contactId;
    }
    if (!contactId && telegram) {
      result = await searchWithFilter(filters.byTelegram);
      contactId = result.contactId;
    }
    contactId = contactId || 0;
    const url = getContactUrl(contactId);
    const firstName = result?.firstName;
    const lastName = result?.lastName;
    return {
      contactId,
      url,
      firstName,
      lastName,
      found: contactId > 0
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[planfixSearchContact] Error: ${errorMessage}`);
    return {
      contactId: 0,
      error: errorMessage,
      found: false
    };
  }
}

async function handler(args?: Record<string, unknown>): Promise<z.infer<typeof PlanfixSearchContactOutputSchema>> {
  args = PlanfixSearchContactInputSchema.parse(args);
  return await planfixSearchContact(args);
}

export default getToolWithHandler({
  name: 'planfix_search_contact',
  description: 'Search for a contact in Planfix by name, phone, email, or telegram',
  inputSchema: PlanfixSearchContactInputSchema,
  outputSchema: PlanfixSearchContactOutputSchema,
  handler,
});
