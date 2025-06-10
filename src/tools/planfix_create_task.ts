import { z } from "zod";
import { getToolWithHandler } from "../helpers.js";
import {
  addToLeadTask,
  AddToLeadTaskOutputSchema,
} from "./planfix_add_to_lead_task.js";

export const PlanfixCreateTaskInputSchema = z.object({
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

  const header = title;
  const messageParts = [];
  if (leadSource) messageParts.push(`Источник: ${leadSource}`);
  if (referral) messageParts.push(`Реферал: ${referral}`);
  const message = messageParts.join("\n");

  return await addToLeadTask({
    ...userData,
    company: agency,
    header,
    message,
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
