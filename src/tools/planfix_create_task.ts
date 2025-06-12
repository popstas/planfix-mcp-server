import { z } from "zod";
import { getToolWithHandler } from "../helpers.js";
import { getFieldDirectoryId } from "../lib/planfixObjects.js";
import {
  addToLeadTask,
  AddToLeadTaskOutputSchema,
} from "./planfix_add_to_lead_task.js";
import { PLANFIX_FIELD_IDS } from "../config.js";

export const PlanfixCreateTaskInputSchema = z.object({
  object: z.string().optional(),
  title: z.string().describe("Task title"),
  name: z.string().optional(),
  nameTranslated: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  telegram: z.string().optional(),
  leadSource: z.string().optional(),
  project: z.string().optional(),
  agency: z.string().optional(),
  referral: z.string().optional(),
  managerEmail: z.string().optional(),
});

export const PlanfixCreateTaskOutputSchema = AddToLeadTaskOutputSchema;

export async function planfixCreateTask(
  args: z.infer<typeof PlanfixCreateTaskInputSchema>,
): Promise<z.infer<typeof PlanfixCreateTaskOutputSchema>> {
  const { agency, referral, leadSource, title, ...userData } = args;

  const messageParts = [];
  if (leadSource) {
    messageParts.push(`Источник: ${leadSource}`);
    if (args.object) {
      const directoryId = await getFieldDirectoryId({
        objectName: args.object,
        fieldId: PLANFIX_FIELD_IDS.leadSource,
      });
      if (directoryId) {
        // TODO: search_directory_entry(directoryId, leadSource)
      }
    }
  }
  if (referral) {
    messageParts.push(`Реферал: ${referral}`);
  }
  const description = messageParts.join("\n");

  return await addToLeadTask({
    ...userData,
    company: agency,
    title,
    description,
    managerEmail: args.managerEmail,
    project: args.project,
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
