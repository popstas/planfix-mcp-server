import { z } from "zod";
import { PLANFIX_FIELD_IDS } from "../config.js";
import {
  getContactUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";

export const PlanfixSearchContactInputSchema = z.object({
  name: z.string().optional(),
  nameTranslated: z.string().optional(),
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
export async function planfixSearchContact({
  name,
  nameTranslated,
  phone,
  email,
  telegram,
}: z.infer<typeof PlanfixSearchContactInputSchema>): Promise<
  z.infer<typeof PlanfixSearchContactOutputSchema>
> {
  // console.log('Searching Planfix contact...');
  let contactId: number | null = null;
  // If phone looks like a Telegram username (starts with @) or doesn't look like a phone number, set it to empty string
  if (phone && (phone.startsWith("@") || !/^[+\d\s\-()]{5,}$/.test(phone))) {
    phone = "";
  }

  const fieldsBase = "id,name,midname,lastname,email,phone,description,group";
  const postBody = {
    offset: 0,
    pageSize: 100,
    filters: [],
    fields: PLANFIX_FIELD_IDS.telegramCustom
      ? `${fieldsBase},${PLANFIX_FIELD_IDS.telegramCustom}`
      : PLANFIX_FIELD_IDS.telegram
        ? `${fieldsBase},telegram`
        : fieldsBase,
  };

  type FilterType = {
    type: number;
    operator: string;
    value?: string | number | boolean | string[];
    field?: number;
  };

  const filters: Record<string, FilterType | undefined> = {
    byName: {
      type: 4001,
      operator: "equal",
      value: name,
    },
    byNameTranslated: {
      type: 4001,
      operator: "equal",
      value: nameTranslated,
    },
    byPhone: {
      type: 4003,
      operator: "equal",
      value: phone,
    },
    byEmail: {
      type: 4026,
      operator: "equal",
      value: email,
    },
    byTelegram: telegram
      ? PLANFIX_FIELD_IDS.telegramCustom
        ? {
            type: 4101,
            field: PLANFIX_FIELD_IDS.telegramCustom,
            operator: "equal",
            value: telegram.replace(/^@/, "").toLowerCase(),
          }
        : PLANFIX_FIELD_IDS.telegram
          ? {
              type: 4226,
              operator: "equal",
              value: telegram.replace(/^@/, "").toLowerCase(),
            }
          : undefined
      : undefined,
    byTelegramWithAt:
      telegram && PLANFIX_FIELD_IDS.telegramCustom
        ? {
            type: 4101,
            field: PLANFIX_FIELD_IDS.telegramCustom,
            operator: "equal",
            value: `@${telegram.replace(/^@/, "").toLowerCase()}`,
          }
        : telegram && PLANFIX_FIELD_IDS.telegram
          ? {
              type: 4226,
              operator: "equal",
              value: telegram.replace(/^@/, "").toLowerCase(),
            }
          : undefined,
  };

  async function searchWithFilter(
    filter: FilterType,
  ): Promise<z.infer<typeof PlanfixSearchContactOutputSchema>> {
    try {
      const result = (await planfixRequest("contact/list", {
        ...postBody,
        filters: [filter],
      })) as {
        contacts?: Array<{ id: number; name?: string; lastname?: string }>;
      };

      if (result.contacts?.[0]) {
        const contact = result.contacts[0];
        return {
          contactId: contact.id,
          firstName: contact.name,
          lastName: contact.lastname,
          found: true,
        };
      }

      return {
        contactId: 0,
        found: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      log(
        `[planfixSearchContact] Error searching with filter: ${errorMessage}`,
      );
      return {
        contactId: 0,
        error: errorMessage,
        found: false,
      };
    }
  }

  try {
    let result: z.infer<typeof PlanfixSearchContactOutputSchema> | undefined;
    if (!contactId && email && filters.byEmail) {
      result = await searchWithFilter(filters.byEmail);
      contactId = result.contactId;
    }
    if (!contactId && phone && filters.byPhone) {
      result = await searchWithFilter(filters.byPhone);
      contactId = result.contactId;
    }
    // Only search by name if both first and last names are provided (contains a space)
    if (!contactId && name && name.trim().includes(" ") && filters.byName) {
      result = await searchWithFilter(filters.byName);
      contactId = result.contactId;
    }
    if (
      !contactId &&
      nameTranslated &&
      nameTranslated.trim().includes(" ") &&
      filters.byNameTranslated
    ) {
      result = await searchWithFilter(filters.byNameTranslated);
      contactId = result.contactId;
    }
    if (!contactId && telegram) {
      // First try without @
      if (filters.byTelegram) {
        result = await searchWithFilter(filters.byTelegram);
        contactId = result.contactId;
      }
      // If not found, try with @
      if (!contactId && filters.byTelegramWithAt) {
        result = await searchWithFilter(filters.byTelegramWithAt);
        contactId = result.contactId;
      }
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
      found: contactId > 0,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[planfixSearchContact] Error: ${errorMessage}`);
    return {
      contactId: 0,
      error: errorMessage,
      found: false,
    };
  }
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof PlanfixSearchContactOutputSchema>> {
  args = PlanfixSearchContactInputSchema.parse(args);
  return await planfixSearchContact(args);
}

export default getToolWithHandler({
  name: "planfix_search_contact",
  description:
    "Search for a contact in Planfix by name, phone, email, or telegram. Use name in 2 languages: Russian and English.",
  inputSchema: PlanfixSearchContactInputSchema,
  outputSchema: PlanfixSearchContactOutputSchema,
  handler,
});
