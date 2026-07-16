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
import {
  additionalEmailsSchema,
  buildEmailMatchList,
  normalizeEmail,
} from "../lib/emailFields.js";
import type { ContactResponse } from "../types.js";

const PlanfixSearchContactInputSchemaBase = z.object({
  name: z.string().optional(),
  nameTranslated: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  additionalEmails: additionalEmailsSchema,
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
  // Additional-email fields are matched via filters, never read off the
  // response, so they are not requested here.
  const fields = PLANFIX_FIELD_IDS.telegramCustom
    ? `${fieldsBase},${PLANFIX_FIELD_IDS.telegramCustom}`
    : PLANFIX_FIELD_IDS.telegram
      ? `${fieldsBase},telegram`
      : fieldsBase;
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

  // System "secondary email" match filter (type 4221, "Contact part of
  // secondary email" in the contact swagger). This is the documented, account-
  // agnostic way to match a contact by an address stored in its additional-
  // emails system field. No `field` id — it is a system field, like the primary
  // email field (4026).
  function buildSecondaryEmailFilter(value: string): FilterType {
    return {
      type: 4221,
      operator: "equal",
      value,
    };
  }

  // Optional custom-field fallback: some accounts mirror extra emails into a
  // numeric custom field (id from PLANFIX_FIELD_ID_EMAIL_ADDITIONAL). Because
  // the system additionalEmailAddresses field is NOT writable via the REST API
  // (absent from ContactRequest), a custom field is the only programmatic way
  // to persist extras, so we also search it when configured. Uses the
  // established numeric-id contact filter (type 4101).
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
    const emailMatchList = buildEmailMatchList(email, additionalEmails);
    if (!contactId && emailMatchList.length) {
      // On a primary-email (4026) miss, look for the contact by any of the
      // known addresses. Order (first match wins):
      //   1. System "secondary email" field via filter 4221 — the documented,
      //      account-agnostic location for additional addresses. Tried for the
      //      primary email too: an address that is primary for us may be stored
      //      as a secondary one on the Planfix side.
      //   2. Optional custom field via filter 4101 — only when configured, for
      //      accounts that mirror extras into a numeric custom field. Tried for
      //      a plain `email` search too: the custom field is the only place this
      //      server can write extras to, so a lone `email` must be matched
      //      against it or a contact we created ourselves would not be found.
      //   3. The main email field (4026) — in case an "additional" address is
      //      actually stored as that contact's primary email. The primary is
      //      skipped here: it was already queried with this filter above, which
      //      also makes this tier a no-op when no additionalEmails were passed.
      const normalizedPrimary = email ? normalizeEmail(email) : "";
      for (const value of emailMatchList) {
        if (contactId) break;
        result = await searchWithFilter(buildSecondaryEmailFilter(value));
        contactId = result.contactId;
      }
      if (PLANFIX_FIELD_IDS.emailAdditional) {
        for (const value of emailMatchList) {
          if (contactId) break;
          result = await searchWithFilter(buildEmailAdditionalFilter(value));
          contactId = result.contactId;
        }
      }
      for (const value of emailMatchList) {
        if (contactId) break;
        if (value === normalizedPrimary) continue;
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
