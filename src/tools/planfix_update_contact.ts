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
import { dedupeAdditionalEmails } from "../lib/emailFields.js";
import { ContactRequestBody, ContactResponse } from "../types.js";

function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

const UpdatePlanfixContactInputSchemaBase = z.object({
  contactId: z.number(),
  name: z.string().optional(),
  telegram: z.string().optional(),
  instagram: z.string().optional(),
  email: z.string().optional(),
  additionalEmails: z.array(z.string()).optional(),
  phone: z.string().optional(),
  forceUpdate: z.boolean().optional(),
});

export const UpdatePlanfixContactInputSchema = extendSchemaWithCustomFields(
  UpdatePlanfixContactInputSchemaBase,
  customFieldsConfig.contactFields,
);

export const UpdatePlanfixContactOutputSchema = z.object({
  contactId: z.number(),
  url: z.string().optional(),
  error: z.string().optional(),
});

export async function updatePlanfixContact(
  args: z.infer<typeof UpdatePlanfixContactInputSchema>,
): Promise<z.infer<typeof UpdatePlanfixContactOutputSchema>> {
  const {
    contactId,
    name,
    telegram,
    instagram,
    email,
    additionalEmails,
    phone,
    forceUpdate,
  } = args;
  try {
    if (PLANFIX_DRY_RUN) {
      log(`[DRY RUN] Would update contact ${contactId}`);
      return { contactId, url: getContactUrl(contactId) };
    }

    const customContactFieldsIds = customFieldsConfig.contactFields.map(
      (f) => f.id,
    );
    const fieldsBase = `id,name,lastname,email,phones,${customContactFieldsIds.join(",")}`;
    let fields = PLANFIX_FIELD_IDS.telegramCustom
      ? `${fieldsBase},${PLANFIX_FIELD_IDS.telegramCustom}`
      : PLANFIX_FIELD_IDS.telegram
        ? `${fieldsBase},telegram`
        : fieldsBase;
    // System field with the contact's secondary/additional emails (read-only).
    fields = `${fields},additionalEmailAddresses`;
    if (PLANFIX_FIELD_IDS.emailAdditional) {
      fields = `${fields},${PLANFIX_FIELD_IDS.emailAdditional}`;
    }
    const { contact } = await planfixRequest<{ contact: ContactResponse }>({
      path: `contact/${contactId}`,
      body: { fields },
      method: "GET",
    });

    const postBody: ContactRequestBody = {
      template: {
        id: Number(process.env.PLANFIX_CONTACT_TEMPLATE_ID || 1),
      },
      customFieldData: [],
    };

    const { firstName, lastName } = name
      ? splitName(name)
      : { firstName: undefined, lastName: undefined };

    const isStubName = ["Клиент", "Контакт"].includes(contact.name || "");
    if (firstName !== undefined) {
      const current = isStubName ? "" : contact.name || "";
      if ((forceUpdate || !current) && firstName !== current) {
        postBody.name = firstName;
      }
    }
    if (lastName !== undefined) {
      const current = isStubName ? "" : contact.lastname || "";
      if ((forceUpdate || !current) && lastName !== current) {
        postBody.lastname = lastName;
      }
    }

    if (email !== undefined) {
      const current = contact.email || "";
      if ((forceUpdate || !current) && email !== current) {
        postBody.email = email;
      }
    }

    if (telegram !== undefined) {
      const normalized = telegram.replace(/^@/, "");
      let current = "";
      if (PLANFIX_FIELD_IDS.telegramCustom) {
        const tgField = contact.customFieldData?.find(
          (f) => f.field.id === PLANFIX_FIELD_IDS.telegramCustom,
        );
        if (tgField && typeof tgField.value === "string") {
          current = tgField.value.replace(/^@/, "");
        }
        if ((forceUpdate || !current) && normalized !== current) {
          postBody.customFieldData = [
            {
              field: { id: PLANFIX_FIELD_IDS.telegramCustom },
              value: "@" + normalized,
            },
          ];
        }
      } else if (PLANFIX_FIELD_IDS.telegram) {
        current = contact.telegram?.replace(/^@/, "") || "";
        if ((forceUpdate || !current) && normalized !== current) {
          postBody.telegram = normalized;
        }
      }
    }

    if (instagram !== undefined) {
      postBody.instagram = instagram.replace(/^@/, "");
    }

    const cleanPhone = (phone: string) => phone.replace(/[^0-9]/g, "");
    if (phone) {
      const phones = contact.phones || [];
      const exists = phones.some((p) => p.number === cleanPhone(phone));
      if (!exists) {
        postBody.phones = [...phones, { number: cleanPhone(phone), type: 1 }];
      }
    }

    await extendPostBodyWithCustomFields(
      postBody,
      args,
      customFieldsConfig.contactFields,
      contact,
    );

    // Persist additional emails into the custom field (id from
    // PLANFIX_FIELD_ID_EMAIL_ADDITIONAL). NOTE: the Planfix *system* field
    // `additionalEmailAddresses` is read-only via the REST API (it is absent
    // from ContactRequest), so a numeric custom field is the only programmatic
    // way to store extras. We still read the system field below so addresses
    // already present there are not duplicated into the custom field.
    // Placed after the telegram block and extendPostBodyWithCustomFields (both
    // of which may set customFieldData) so the push appends instead of being
    // overwritten.
    if (additionalEmails !== undefined && PLANFIX_FIELD_IDS.emailAdditional) {
      // Read existing custom-field values (string or string[]) to merge against.
      const existingField = contact.customFieldData?.find(
        (f) => f.field.id === PLANFIX_FIELD_IDS.emailAdditional,
      );
      const existingCustom: string[] = Array.isArray(existingField?.value)
        ? (existingField.value as unknown[]).filter(
            (v): v is string => typeof v === "string",
          )
        : typeof existingField?.value === "string"
          ? [existingField.value]
          : [];
      // Also treat addresses already in the system field as existing, so we do
      // not re-add an address the contact already has.
      const existingSystem: string[] = Array.isArray(
        contact.additionalEmailAddresses,
      )
        ? contact.additionalEmailAddresses.filter(
            (v): v is string => typeof v === "string",
          )
        : [];
      const existing: string[] = [...existingCustom, ...existingSystem];

      // A call carrying only `additionalEmails` must not copy the contact's
      // current primary address into the custom field.
      const primary = email ?? contact.email;

      if (forceUpdate) {
        // Rewrite the field with the provided set, even when empty (clears it).
        postBody.customFieldData.push({
          field: { id: PLANFIX_FIELD_IDS.emailAdditional },
          value: dedupeAdditionalEmails(primary, additionalEmails),
        });
      } else {
        // Add only genuinely-new values. Custom-field writes replace the whole
        // value, so send the union with what is already stored there.
        // Addresses that only live in the read-only system field are used for
        // dedup but are not copied into the custom field.
        const extras = dedupeAdditionalEmails(
          primary,
          additionalEmails,
          existing,
        );
        if (extras.length) {
          postBody.customFieldData.push({
            field: { id: PLANFIX_FIELD_IDS.emailAdditional },
            value: [...existingCustom, ...extras],
          });
        }
      }
    }

    const hasUpdates =
      Object.keys(postBody).some(
        (k) => k !== "template" && k !== "customFieldData",
      ) || postBody.customFieldData.length > 0;
    if (!hasUpdates) {
      return { contactId, url: getContactUrl(contactId) };
    }

    await planfixRequest({ path: `contact/${contactId}`, body: postBody });
    return { contactId, url: getContactUrl(contactId) };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[updatePlanfixContact] Error: ${errorMessage}`);
    return { contactId: 0, error: errorMessage };
  }
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof UpdatePlanfixContactOutputSchema>> {
  const parsedArgs = UpdatePlanfixContactInputSchema.parse(args);
  return updatePlanfixContact(parsedArgs);
}

export const planfixUpdateContactTool = getToolWithHandler({
  name: "planfix_update_contact",
  description: "Update a contact in Planfix with new data",
  inputSchema: UpdatePlanfixContactInputSchema,
  outputSchema: UpdatePlanfixContactOutputSchema,
  handler,
});

export default planfixUpdateContactTool;
