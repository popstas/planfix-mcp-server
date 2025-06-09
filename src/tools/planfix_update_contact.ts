import { z } from "zod";
import {
  PLANFIX_DRY_RUN,
  PLANFIX_FIELD_ID_TELEGRAM,
  PLANFIX_FIELD_ID_TELEGRAM_CUSTOM,
} from "../config.js";
import {
  getContactUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import type { CustomFieldDataType } from "../types.js";

interface ContactResponse {
  id: number;
  name?: string;
  lastname?: string;
  email?: string;
  phones?: Array<{ number: string; type?: number }>;
  telegram?: string;
  customFieldData?: CustomFieldDataType[];
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

export const UpdatePlanfixContactInputSchema = z.object({
  contactId: z.number(),
  name: z.string().optional(),
  telegram: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  forceUpdate: z.boolean().optional(),
});

export const UpdatePlanfixContactOutputSchema = z.object({
  contactId: z.number(),
  url: z.string().optional(),
  error: z.string().optional(),
});

export async function updatePlanfixContact({
  contactId,
  name,
  telegram,
  email,
  phone,
  forceUpdate,
}: z.infer<typeof UpdatePlanfixContactInputSchema>): Promise<
  z.infer<typeof UpdatePlanfixContactOutputSchema>
> {
  try {
    if (PLANFIX_DRY_RUN) {
      log(`[DRY RUN] Would update contact ${contactId}`);
      return { contactId, url: getContactUrl(contactId) };
    }

    const fieldsBase = `id,name,lastname,email,phones`;
    const fields = PLANFIX_FIELD_ID_TELEGRAM_CUSTOM
      ? `${fieldsBase},customFieldData`
      : PLANFIX_FIELD_ID_TELEGRAM
        ? `${fieldsBase},telegram`
        : fieldsBase;
    const { contact } = await planfixRequest<{ contact: ContactResponse }>(
      `contact/${contactId}`,
      { fields },
      "GET",
    );

    const postBody: Record<string, unknown> = {};

    const { firstName, lastName } = name
      ? splitName(name)
      : { firstName: undefined, lastName: undefined };

    if (firstName !== undefined) {
      const current = contact.name || "";
      if ((forceUpdate || !current) && firstName !== current) {
        postBody.name = firstName;
      }
    }
    if (lastName !== undefined) {
      const current = contact.lastname || "";
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
      if (PLANFIX_FIELD_ID_TELEGRAM_CUSTOM) {
        const tgField = contact.customFieldData?.find(
          (f) => f.field.id === PLANFIX_FIELD_ID_TELEGRAM_CUSTOM,
        );
        if (tgField && typeof tgField.value === "string") {
          current = tgField.value.replace(/^@/, "");
        }
        if ((forceUpdate || !current) && normalized !== current) {
          postBody.customFieldData = [
            {
              field: { id: PLANFIX_FIELD_ID_TELEGRAM_CUSTOM },
              value: "@" + normalized,
            },
          ];
        }
      } else if (PLANFIX_FIELD_ID_TELEGRAM) {
        current = contact.telegram?.replace(/^@/, "") || "";
        if ((forceUpdate || !current) && normalized !== current) {
          postBody.telegram = "@" + normalized;
        }
      }
    }

    if (phone) {
      const phones = contact.phones || [];
      const exists = phones.some((p) => p.number === phone);
      if (!exists) {
        postBody.phones = [...phones, { number: phone, type: 1 }];
      }
    }

    if (Object.keys(postBody).length === 0) {
      return { contactId, url: getContactUrl(contactId) };
    }

    await planfixRequest(`contact/${contactId}`, postBody);
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
