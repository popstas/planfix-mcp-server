import { z } from "zod";
import { getToolWithHandler } from "../helpers.js";
import { customFieldsConfig } from "../customFieldsConfig.js";
import { extendSchemaWithCustomFields } from "../lib/extendSchemaWithCustomFields.js";
import {
  addToLeadTask,
  AddToLeadTaskOutputSchema,
} from "./planfix_add_to_lead_task.js";

const PlanfixCreateTaskInputSchemaBase = z.object({
  object: z.string().optional().describe("Object of the task"),
  title: z.string().optional().describe("Title of the task"),
  description: z.string().optional().describe("Description of the task"),
  name: z.string().optional().describe("Name of the client"),
  nameTranslated: z.string().optional().describe("Translated name of the client"),
  phone: z.string().optional().describe("Phone of the client"),
  email: z.string().optional(),
  telegram: z.string().optional(),
  leadSource: z.string().optional(),
  pipeline: z.string().optional(),
  project: z.string().optional(),
  agency: z.string().optional(),
  referral: z.string().optional(),
  managerEmail: z.string().optional(),
  tags: z.array(z.string()).optional(),
  leadId: z.number().optional().describe("ID of the lead at leadSource"),
});

export const PlanfixCreateTaskInputSchema = extendSchemaWithCustomFields(
  PlanfixCreateTaskInputSchemaBase,
  customFieldsConfig.leadTaskFields,
);

export const PlanfixCreateTaskOutputSchema = AddToLeadTaskOutputSchema;

export async function planfixCreateTask(
  args: z.infer<typeof PlanfixCreateTaskInputSchema>,
): Promise<z.infer<typeof PlanfixCreateTaskOutputSchema>> {
  const {
    agency,
    referral,
    managerEmail,
  } = args;

  const messageParts = [];
  if (referral) {
    messageParts.push(`Реферал: ${referral}`);
  }
  if (managerEmail) {
    messageParts.push(`Менеджер: ${managerEmail}`);
  }
  if (args.description) {
    messageParts.push(args.description);
  }
  const description = messageParts.join("\n");

  return await addToLeadTask({
    ...args,
    company: agency,
    description,
  });
}

export async function handler(args?: Record<string, unknown>) {
  const parsed = PlanfixCreateTaskInputSchema.parse(args);
  return planfixCreateTask(parsed);
}

export const planfixCreateTaskTool = getToolWithHandler({
  name: "planfix_create_task",
  description: "Create a task using textual parameters",
  inputSchema: PlanfixCreateTaskInputSchema,
  outputSchema: PlanfixCreateTaskOutputSchema,
  handler,
});

export default planfixCreateTaskTool;
