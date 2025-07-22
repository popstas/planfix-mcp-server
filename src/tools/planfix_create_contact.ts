import { z } from "zod";
import { PLANFIX_DRY_RUN, PLANFIX_FIELD_IDS } from "../config.js";
import {
  getContactUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import { customFieldsConfig } from "../customFieldsConfig.js";
import { extendSchemaWithCustomFields } from "../lib/extendSchemaWithCustomFields.js";
import { extendPostBodyWithCustomFields } from "../lib/extendPostBodyWithCustomFields.js";
import { ContactRequestBody } from "../types.js";

const CreatePlanfixContactInputSchemaBase = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  telegram: z.string().optional(),
  instagram: z.string().optional(),
});

export const CreatePlanfixContactInputSchema = extendSchemaWithCustomFields(
  CreatePlanfixContactInputSchemaBase,
  customFieldsConfig.contactFields,
);

export const CreatePlanfixContactOutputSchema = z.object({
  contactId: z.number(),
  url: z.string().optional(),
  error: z.string().optional(),
});

// Helper function to split full name into first and last name
function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: "", lastName: "" };

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

/**
 * Create a new contact in Planfix
 * @param userData - Contact information including name, phone, email, and telegram
 * @returns Promise with the created contact ID and URL
 */
export async function createPlanfixContact(
  userData: z.infer<typeof CreatePlanfixContactInputSchema>,
): Promise<z.infer<typeof CreatePlanfixContactOutputSchema>> {
  try {
    if (PLANFIX_DRY_RUN) {
      const mockId = 55500000 + Math.floor(Math.random() * 10000);
      log(
        `[DRY RUN] Would create contact with name: ${userData.name || "N/A"}, email: ${userData.email || "N/A"}`,
      );
      return {
        contactId: mockId,
        url: `https://example.com/contact/${mockId}`,
      };
    }
    const { firstName, lastName } = splitName(userData.name || "");
    const postBody: ContactRequestBody = {
      template: {
        id: Number(process.env.PLANFIX_CONTACT_TEMPLATE_ID || 1),
      },
      name: firstName,
      lastname: lastName,
      email: userData.email,
      phones: [],
      customFieldData: [],
    };

    // Add phone if available
    if (userData.phone && postBody.phones) {
      postBody.phones.push({
        type: 1, // mobile
        number: userData.phone,
      });
    }

    // Add telegram if available
    if (userData.telegram) {
      const normalized = "@" + userData.telegram.replace(/^@/, "");
      if (PLANFIX_FIELD_IDS.telegramCustom) {
        postBody.customFieldData.push({
          field: {
            id: PLANFIX_FIELD_IDS.telegramCustom,
          },
          value: normalized,
        });
      } else if (PLANFIX_FIELD_IDS.telegram) {
        postBody.telegram = normalized;
      }
    }

    // Add instagram if available
    if (userData.instagram) {
      postBody.instagram = userData.instagram.replace(/^@/, "");
    }

    await extendPostBodyWithCustomFields(
      postBody,
      userData as Record<string, unknown>,
      customFieldsConfig.contactFields,
    );

    const result = await planfixRequest<{ id: number }>({
      path: `contact/`,
      body: postBody as unknown as Record<string, unknown>,
    });
    const contactId = result.id;
    const url = getContactUrl(contactId);

    return { contactId, url };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const err = `Error creating contact: ${errMsg}`;
    log(err);
    return { contactId: 0, url: undefined, error: err };
  }
}

export async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof CreatePlanfixContactOutputSchema>> {
  const parsedArgs = CreatePlanfixContactInputSchema.parse(args);
  return createPlanfixContact(parsedArgs);
}

export const planfixCreateContactTool = getToolWithHandler({
  name: "planfix_create_contact",
  description: "Create a new contact in Planfix",
  inputSchema: CreatePlanfixContactInputSchema,
  outputSchema: CreatePlanfixContactOutputSchema,
  handler,
});

export default planfixCreateContactTool;
