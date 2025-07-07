import { z } from "zod";
import { UserDataInputSchema } from "../../types.js";
import { customFieldsConfig } from "../../customFieldsConfig.js";
import { extendSchemaWithCustomFields } from "../../lib/extendSchemaWithCustomFields.js";

const LeadTaskBaseSchemaBase = UserDataInputSchema.extend({
  title: z.string().optional(),
  description: z.string().optional(),
  managerEmail: z.string().optional(),
  project: z.string().optional(),
  leadSource: z.string().optional(),
  pipeline: z.string().optional(),
  tags: z.array(z.string()).optional(),
  leadId: z.number().optional(),
});

export const LeadTaskBaseSchema = extendSchemaWithCustomFields(
  LeadTaskBaseSchemaBase,
  customFieldsConfig.leadTaskFields,
);

export const AddToLeadTaskInputSchema = extendSchemaWithCustomFields(
  LeadTaskBaseSchema,
  customFieldsConfig.leadTaskFields,
);

export const AddToLeadTaskOutputSchema = z.object({
  taskId: z.number(),
  clientId: z.number(),
  url: z.string().optional(),
  clientUrl: z.string().optional(),
  assignees: z
    .object({
      users: z
        .array(
          z.object({
            id: z.string(),
            name: z.string().optional(),
          }),
        )
        .optional(),
      groups: z
        .array(
          z.object({
            id: z.number(),
            name: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  agencyId: z.number().optional(),
  error: z.string().optional(),
});

export const UpdateLeadTaskInputSchema = extendSchemaWithCustomFields(
  LeadTaskBaseSchemaBase.extend({
    taskId: z.number(),
    status: z.enum(["closed", "active"]).optional(),
    forceUpdate: z.boolean().optional(),
  }),
  customFieldsConfig.leadTaskFields,
);

export const UpdateLeadTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string().optional(),
  error: z.string().optional(),
});
