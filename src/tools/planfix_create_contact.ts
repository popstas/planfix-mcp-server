import { z } from 'zod';
import { PLANFIX_FIELD_IDS } from '../config.js';
import { log, planfixRequest, getContactUrl, getToolWithHandler } from '../helpers.js';
import { CustomFieldDataType } from '../types.js';

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
  if (!fullName) return { firstName: '', lastName: '' };
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
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
    const { firstName, lastName } = splitName(userData.name || '');
    const postBody: any = {
      template: {
        id: Number(process.env.PLANFIX_CONTACT_TEMPLATE_ID),
      },
      name: firstName,
      lastname: lastName,
      email: userData.email,
      phones: [],
      customFieldData: [] as CustomFieldDataType[],
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

    const result = await planfixRequest(`contact/`, postBody);
    const contactId = result.id;
    const url = getContactUrl(contactId);
    
    return { contactId, url };
  } catch (error: any) {
    log(`[createPlanfixContact] Error: ${error.message}`);
    return { contactId: 0, url: undefined };
  }
}

export function handler(args?: Record<string, unknown>) {
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
