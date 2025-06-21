import { z } from "zod";
import { getToolWithHandler } from "../helpers.js";
import {
  addToLeadTask,
  AddToLeadTaskOutputSchema,
} from "./planfix_add_to_lead_task.js";

export const PlanfixCreateTaskInputSchema = z.object({
  object: z.string().optional(),
  title: z.string().describe("Task title"),
  description: z.string().optional(),
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
  tags: z.array(z.string()).optional(),
});

export const PlanfixCreateTaskOutputSchema = AddToLeadTaskOutputSchema;

export async function planfixCreateTask(
  args: z.infer<typeof PlanfixCreateTaskInputSchema>
): Promise<z.infer<typeof PlanfixCreateTaskOutputSchema>> {
  const { agency, referral, leadSource, title, managerEmail, ...userData } =
    args;

  const messageParts = [];
  if (leadSource) {
    messageParts.push(`Источник: ${leadSource}`);
  }
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
    ...userData,
    company: agency,
    title,
    description,
    managerEmail,
    project: args.project,
    leadSource,
    referral,
    tags: args.tags,
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
