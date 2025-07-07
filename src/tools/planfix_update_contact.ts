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
import { ContactResponse } from "../types.js";

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
  const { contactId, name, telegram, instagram, email, phone, forceUpdate } =
    args;
  try {
    if (PLANFIX_DRY_RUN) {
      log(`[DRY RUN] Would update contact ${contactId}`);
      return { contactId, url: getContactUrl(contactId) };
    }

    const customContactFieldsIds = customFieldsConfig.contactFields.map(
      (f) => f.id,
    );
    const fieldsBase = `id,name,lastname,email,phones,${customContactFieldsIds.join(",")}`;
    const fields = PLANFIX_FIELD_IDS.telegramCustom
      ? `${fieldsBase},${PLANFIX_FIELD_IDS.telegramCustom}`
      : PLANFIX_FIELD_IDS.telegram
        ? `${fieldsBase},telegram`
        : fieldsBase;
    const { contact } = await planfixRequest<{ contact: ContactResponse }>({
      path: `contact/${contactId}`,
      body: { fields },
      method: "GET",
    });

    const postBody: Record<string, unknown> = {};

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

    extendPostBodyWithCustomFields(
      postBody,
      args,
      customFieldsConfig.contactFields,
      contact,
    );

    if (Object.keys(postBody).length === 0) {
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
