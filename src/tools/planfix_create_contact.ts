import {z} from 'zod';
import {PLANFIX_FIELD_IDS} from '../config.js';
import {getContactUrl, getToolWithHandler, log, planfixRequest} from '../helpers.js';
import type {CustomFieldDataType} from '../types.js';

interface ContactRequestBody {
  template: {
    id: number;
  };
  name: string;
  lastname: string;
  email?: string;
  phones: Array<{
    type: number;
    number: string;
  }>;
  customFieldData: CustomFieldDataType[];
}

export const CreatePlanfixContactInputSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  telegram: z.string().optional(),
});

export const CreatePlanfixContactOutputSchema = z.object({
  contactId: z.number(),
  url: z.string().optional(),
});

// Helper function to split full name into first and last name
function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return {firstName: '', lastName: ''};

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return {firstName: parts[0], lastName: ''};

  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return {firstName, lastName};
}

/**
 * Create a new contact in Planfix
 * @param userData - Contact information including name, phone, email, and telegram
 * @returns Promise with the created contact ID and URL
 */
export async function createPlanfixContact(
  userData: z.infer<typeof CreatePlanfixContactInputSchema>
): Promise<z.infer<typeof CreatePlanfixContactOutputSchema>> {
  try {
    const {firstName, lastName} = splitName(userData.name || '');
    const postBody: ContactRequestBody = {
      template: {
        id: Number(process.env.PLANFIX_CONTACT_TEMPLATE_ID || 0),
      },
      name: firstName,
      lastname: lastName,
      email: userData.email,
      phones: [],
      customFieldData: [],
    };

    // Add phone if available
    if (userData.phone) {
      postBody.phones.push({
        type: 1, // mobile
        number: userData.phone,
      });
    }

    // Add telegram if available
    if (userData.telegram) {
      postBody.customFieldData.push({
        field: {
          id: PLANFIX_FIELD_IDS.telegram,
        },
        value: '@' + userData.telegram.replace(/^@/, ''),
      });
    }

    const result = await planfixRequest<{ id: number }>(`contact/`, postBody as unknown as Record<string, unknown>);
    const contactId = result.id;
    const url = getContactUrl(contactId);

    return {contactId, url};
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[createPlanfixContact] Error: ${errorMessage}`);
    return {contactId: 0, url: undefined};
  }
}

export async function handler(
  args?: Record<string, unknown>
): Promise<z.infer<typeof CreatePlanfixContactOutputSchema>> {
  const parsedArgs = CreatePlanfixContactInputSchema.parse(args);
  return createPlanfixContact(parsedArgs);
}

export const planfixCreateContactTool = getToolWithHandler({
  name: 'planfix_create_contact',
  description: 'Create a new contact in Planfix',
  inputSchema: CreatePlanfixContactInputSchema,
  outputSchema: CreatePlanfixContactOutputSchema,
  handler,
});

export default planfixCreateContactTool;
