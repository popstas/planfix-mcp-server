import { z } from "zod";
import { PLANFIX_FIELD_IDS } from "../config.js";
import {
  getContactUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import { customFieldsConfig } from "../customFieldsConfig.js";
import { extendSchemaWithCustomFields } from "../lib/extendSchemaWithCustomFields.js";
import { extendFiltersWithCustomFields } from "../lib/extendFiltersWithCustomFields.js";
import { buildEmailMatchList } from "../lib/emailFields.js";
import type { ContactResponse } from "../types.js";

const PlanfixSearchContactInputSchemaBase = z.object({
  name: z.string().optional(),
  nameTranslated: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  additionalEmails: z.array(z.string()).optional(),
  telegram: z.string().optional(),
});

export const PlanfixSearchContactInputSchema = extendSchemaWithCustomFields(
  PlanfixSearchContactInputSchemaBase,
  customFieldsConfig.contactFields,
);

export const PlanfixSearchContactOutputSchema = z.object({
  contactId: z.number(),
  url: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  error: z.string().optional(),
  found: z.boolean(),
  telegram: z.string().optional(),
});

export async function planfixSearchContact(
  args: z.infer<typeof PlanfixSearchContactInputSchema>,
): Promise<z.infer<typeof PlanfixSearchContactOutputSchema>> {
  const { name, nameTranslated, email, additionalEmails, telegram } = args;
  let { phone } = args;
  let contactId: number | null = null;
  if (phone && (phone.startsWith("@") || !/^[+\d\s\-()]{5,}$/.test(phone))) {
    phone = "";
  }

  const fieldsBase = "id,name,midname,lastname,email,phone,description,group";
  let fields = PLANFIX_FIELD_IDS.telegramCustom
    ? `${fieldsBase},${PLANFIX_FIELD_IDS.telegramCustom}`
    : PLANFIX_FIELD_IDS.telegram
      ? `${fieldsBase},telegram`
      : fieldsBase;
  if (PLANFIX_FIELD_IDS.emailAdditional) {
    fields = `${fields},${PLANFIX_FIELD_IDS.emailAdditional}`;
  }
  const postBody = {
    offset: 0,
    pageSize: 100,
    filters: [],
    fields,
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
              value: `@${telegram.replace(/^@/, "").toLowerCase()}`,
            }
          : undefined,
    byTelegramOriginalCase: telegram
      ? PLANFIX_FIELD_IDS.telegramCustom
        ? {
            type: 4101,
            field: PLANFIX_FIELD_IDS.telegramCustom,
            operator: "equal",
            value: telegram.replace(/^@/, ""),
          }
        : PLANFIX_FIELD_IDS.telegram
          ? {
              type: 4226,
              operator: "equal",
              value: telegram.replace(/^@/, ""),
            }
          : undefined
      : undefined,
    byTelegramOriginalCaseWithAt: telegram
      ? PLANFIX_FIELD_IDS.telegramCustom
        ? {
            type: 4101,
            field: PLANFIX_FIELD_IDS.telegramCustom,
            operator: "equal",
            value: telegram.startsWith("@") ? telegram : `@${telegram}`,
          }
        : PLANFIX_FIELD_IDS.telegram
          ? {
              type: 4226,
              operator: "equal",
              value: telegram.startsWith("@") ? telegram : `@${telegram}`,
            }
          : undefined
      : undefined,
    byTelegramUrl: telegram
      ? PLANFIX_FIELD_IDS.telegramCustom
        ? {
            type: 4101,
            field: PLANFIX_FIELD_IDS.telegramCustom,
            operator: "equal",
            value: `https://t.me/${telegram.replace(/^@/, "")}`,
          }
        : PLANFIX_FIELD_IDS.telegram
          ? {
              type: 4226,
              operator: "equal",
              value: `https://t.me/${telegram.replace(/^@/, "")}`,
            }
          : undefined
      : undefined,
  };

  // Single source of truth for the field-124 ("additional emails") match filter.
  // Uses the established numeric-id contact filter (type 4101). If the live API
  // disagrees with this shape (Task 6), adjust it here only.
  function buildEmailAdditionalFilter(value: string): FilterType {
    return {
      type: 4101,
      field: PLANFIX_FIELD_IDS.emailAdditional,
      operator: "equal",
      value,
    };
  }

  const customFilters: FilterType[] = [];
  extendFiltersWithCustomFields(
    customFilters,
    args,
    customFieldsConfig.contactFields,
    "contact",
  );

  function extractTelegramFromContact(contact: ContactResponse): string {
    if (PLANFIX_FIELD_IDS.telegramCustom) {
      const tgField = contact.customFieldData?.find(
        (f) => f.field.id === PLANFIX_FIELD_IDS.telegramCustom,
      );
      if (tgField && typeof tgField.value === "string") {
        return tgField.value.replace(/^@/, "").toLowerCase();
      }
    } else if (PLANFIX_FIELD_IDS.telegram && contact.telegram) {
      return contact.telegram.replace(/^@/, "").toLowerCase();
    }
    return "";
  }

  async function searchWithFilter(
    filter: FilterType,
  ): Promise<z.infer<typeof PlanfixSearchContactOutputSchema>> {
    try {
      const result = (await planfixRequest({
        path: "contact/list",
        body: {
          ...postBody,
          filters: [filter],
        },
      })) as {
        contacts?: Array<ContactResponse>;
      };

      if (result.contacts?.[0]) {
        const contact = result.contacts[0];
        const contactTelegram = extractTelegramFromContact(contact);
        return {
          contactId: contact.id,
          firstName: contact.name,
          lastName: contact.lastname,
          found: true,
          telegram: contactTelegram || undefined,
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
    if (
      !contactId &&
      additionalEmails &&
      additionalEmails.length &&
      PLANFIX_FIELD_IDS.emailAdditional
    ) {
      // On a primary-email miss, try every known email (primary + additional)
      // against the field-124 filter, and try each *additional* email against
      // the main email field (4026) too. First match wins.
      const emailMatchList = buildEmailMatchList(email, additionalEmails);
      const additionalNormalized = buildEmailMatchList(
        undefined,
        additionalEmails,
      );
      for (const value of emailMatchList) {
        if (contactId) break;
        result = await searchWithFilter(buildEmailAdditionalFilter(value));
        contactId = result.contactId;
      }
      for (const value of additionalNormalized) {
        if (contactId) break;
        result = await searchWithFilter({
          type: 4026,
          operator: "equal",
          value,
        });
        contactId = result.contactId;
      }
    }
    if (!contactId && phone && filters.byPhone) {
      result = await searchWithFilter(filters.byPhone);
      contactId = result.contactId;
    }
    if (!contactId && name && name.trim().includes(" ") && filters.byName) {
      result = await searchWithFilter(filters.byName);
      contactId = result.contactId;
      if (telegram && contactId > 0 && result.telegram) {
        const expectedTelegram = telegram.replace(/^@/, "").toLowerCase();
        const foundTelegram = result.telegram;
        if (expectedTelegram !== foundTelegram) {
          log(
            `[planfixSearchContact] Telegram не совпадает: ожидался "${telegram}", найден "${result.telegram}"`,
          );
          contactId = null;
          result = undefined;
        }
      }
    }
    if (
      !contactId &&
      nameTranslated &&
      nameTranslated.trim().includes(" ") &&
      filters.byNameTranslated
    ) {
      result = await searchWithFilter(filters.byNameTranslated);
      contactId = result.contactId;
      if (telegram && contactId > 0 && result.telegram) {
        const expectedTelegram = telegram.replace(/^@/, "").toLowerCase();
        const foundTelegram = result.telegram;
        if (expectedTelegram !== foundTelegram) {
          log(
            `[planfixSearchContact] Telegram не совпадает: ожидался "${telegram}", найден "${result.telegram}"`,
          );
          contactId = null;
          result = undefined;
        }
      }
    }
    if (!contactId && telegram) {
      if (filters.byTelegram) {
        result = await searchWithFilter(filters.byTelegram);
        contactId = result.contactId;
      }
      if (!contactId && filters.byTelegramWithAt) {
        result = await searchWithFilter(filters.byTelegramWithAt);
        contactId = result.contactId;
      }
      if (!contactId && filters.byTelegramOriginalCase) {
        result = await searchWithFilter(filters.byTelegramOriginalCase);
        contactId = result.contactId;
      }
      if (!contactId && filters.byTelegramOriginalCaseWithAt) {
        result = await searchWithFilter(filters.byTelegramOriginalCaseWithAt);
        contactId = result.contactId;
      }
      if (!contactId && filters.byTelegramUrl) {
        result = await searchWithFilter(filters.byTelegramUrl);
        contactId = result.contactId;
      }
    }
    if (!contactId && customFilters.length) {
      for (const cf of customFilters) {
        if (contactId) break;
        result = await searchWithFilter(cf);
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
