import { z } from "zod";
import { UserDataInputSchema } from "../../types.js";

export const LeadTaskBaseSchema = UserDataInputSchema.extend({
  title: z.string().optional(),
  description: z.string().optional(),
  managerEmail: z.string().optional(),
  project: z.string().optional(),
  leadSource: z.string().optional(),
  pipeline: z.string().optional(),
  referral: z.string().optional(),
  tags: z.array(z.string()).optional(),
  leadId: z.number().optional(),
});

export const AddToLeadTaskInputSchema = LeadTaskBaseSchema;

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
            id: z.string(),
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

export const UpdateLeadTaskInputSchema = LeadTaskBaseSchema.extend({
  taskId: z.number(),
  forceUpdate: z.boolean().optional(),
});

export const UpdateLeadTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string().optional(),
  error: z.string().optional(),
});
