import { z } from "zod";
import { PLANFIX_DRY_RUN } from "../config.js";
import {
  log,
  getToolWithHandler,
  getTaskUrl,
  getCommentUrl,
  getContactUrl,
} from "../helpers.js";
import { UserDataInputSchema } from "../types.js";
import { searchLeadTask } from "./planfix_search_lead_task.js";
import { createPlanfixContact } from "./planfix_create_contact.js";
import { createLeadTask } from "./planfix_create_lead_task.js";
import { createComment } from "./planfix_create_comment.js";
import { searchManager } from "./planfix_search_manager.js";
import { searchPlanfixTask } from "./planfix_search_task.js";
import { updatePlanfixContact } from "./planfix_update_contact.js";
import { updateLeadTask } from "./planfix_update_lead_task.js";
import { 
  AddToLeadTaskInputSchema,
  AddToLeadTaskOutputSchema 
} from "./schemas/leadTaskSchemas.js";

export { 
  AddToLeadTaskInputSchema,
  AddToLeadTaskOutputSchema 
};

// Helper: generate description for the task/comment
function generateDescription(
  userData: z.infer<typeof UserDataInputSchema>,
  eventData: {
    title?: string;
    description?: string;
  },
  taskTitle?: string,
): string {
  // Simple userData labels for Russian output
  const userDataLabels: Record<string, string> = {
    name: "Имя",
    phone: "Телефон",
    email: "Email",
    telegram: "Telegram",
    company: "Компания",
  };

  const lines: string[] = [];
  if (eventData?.title && eventData.title !== taskTitle) {
    lines.push(eventData.title);
    lines.push("");
  }

  if (eventData?.description) {
    lines.push(eventData.description);
    lines.push("");
  }

  const userLines = [] as string[];
  if (userData) {
    for (const key of Object.keys(userData)) {
      if (userData[key as keyof typeof userData] && userDataLabels[key]) {
        userLines.push(
          `${userDataLabels[key]}: ${userData[key as keyof typeof userData]}`,
        );
      }
    }
  }

  if (userLines.length) {
    if (lines.length) lines.push("");
    lines.push(...userLines);
  }

  if (!lines.length) {
    return `Заявка от ${new Date().toLocaleString()}`;
  }

  return lines.join("\n");
}

/**
 * Adds content to an existing lead task in Planfix
 * @param params - Parameters including leadTaskId and content to add
 * @returns Promise with the result of the operation
 */
export async function addToLeadTask({
  name,
  nameTranslated,
  phone,
  email,
  telegram,
  company,
  title,
  description,
  managerEmail,
  project,
  leadSource,
  pipeline,
  referral,
  tags,
}: z.infer<typeof AddToLeadTaskInputSchema>): Promise<
  z.infer<typeof AddToLeadTaskOutputSchema>
> {
  // Helper: template string replacement
  function replaceTemplateVars(
    template: string,
    vars: Record<string, string | undefined>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`{${key}}`, "g"), value ?? "");
    }
    return result;
  }

  const userData = { name, nameTranslated, phone, email, telegram, company };
  const eventData = { title, description };
  // Main logic

  try {
    if (PLANFIX_DRY_RUN) {
      const mockTaskId = 55500000 + Math.floor(Math.random() * 10000);
      const mockClientId = 55500000 + Math.floor(Math.random() * 10000);
      log(`[DRY RUN] Would process lead task for ${name || "unnamed client"}`);
      return {
        taskId: mockTaskId,
        clientId: mockClientId,
        url: getTaskUrl(mockTaskId),
        clientUrl: getContactUrl(mockClientId),
        assignees: { users: [] },
      };
    }

    // 1. Try to get taskId and clientId
    const searchResult = await searchLeadTask(userData);
    // Variables that might be reassigned later
    let { taskId, clientId, url, clientUrl, assignees } = searchResult;
    // Variables that won't be reassigned
    const { firstName, lastName, agencyId } = searchResult;
    const taskTitleTemplate = "{clientName} - работа с клиентом";
    const finalTaskTitle = title
      ? title
      : replaceTemplateVars(taskTitleTemplate, {
          clientName: userData.name,
        });

    const descriptionText = generateDescription(
      userData,
      eventData,
      finalTaskTitle,
    );
    if (!descriptionText) {
      // console.log('[leadToTask] No description to send, skip create client or task');
      return { taskId, clientId, url, clientUrl };
    }

    // 2. If contact not found, create it
    if (!clientId) {
      // console.log('[leadToTask] Creating contact...');
      if (!userData.name) {
        // const nowDatetime = new Date().toLocaleString();
        userData.name =
          userData.telegram || userData.phone || userData.email
            ? ((userData.telegram ||
                userData.phone ||
                userData.email) as string)
            : ""; //`Контакт ${nowDatetime}`;
      }
      const createResult = await createPlanfixContact(userData);
      clientId = createResult.contactId || 0;
    }
    // 3. Update contact with provided data
    if (clientId) {
      await updatePlanfixContact({
        contactId: clientId,
        name: userData.name,
        telegram: userData.telegram,
        email: userData.email,
        phone: userData.phone,
      });
    }
    // 4. If task not found and name has space, search by name
    if (clientId && !taskId && userData.name && userData.name.includes(" ")) {
      // console.log('[leadToTask] Searching for task by name...');
      const result = await searchPlanfixTask({
        taskTitle: finalTaskTitle,
      });
      taskId = result.taskId || 0;
      assignees = result.assignees;
    }
    // 5. If still no task, create it
    let commentId: number | undefined;

    if (!taskId) {
      assignees = { users: [] };
      let managerId: number | null = null;
      if (managerEmail) {
        const managerResult = await searchManager({ email: managerEmail });
        managerId = managerResult.managerId;
      }
      const createLeadTaskResult = await createLeadTask({
        name: finalTaskTitle,
        description: descriptionText,
        clientId,
        managerId: managerId ?? undefined,
        agencyId,
        project,
        leadSource,
        pipeline,
        referral,
        tags,
      });
      if (createLeadTaskResult.error) {
        return { taskId: 0, clientId: 0, error: createLeadTaskResult.error };
      }
      taskId = createLeadTaskResult.taskId || 0;
      if (managerId) {
        assignees.users = [{ id: `user:${managerId}` }];
      }
    } else {
      // 6. If task found, add comment
      const commentResult = await createComment({
        taskId,
        description: descriptionText,
        // recipients: assignees,
      });
      if (commentResult.commentId) {
        commentId = commentResult.commentId;
        log(`[leadToTask] Comment created with ID: ${commentId}`);
      }

      // 7. Update lead task
      const updateLeadTaskResult = await updateLeadTask({
        taskId,
        description: descriptionText,
        managerEmail,
        project,
        leadSource,
        pipeline,
        referral,
        tags,
      });
      if (updateLeadTaskResult.error) {
        return { taskId: 0, clientId: 0, error: updateLeadTaskResult.error };
      }
    }

    url = commentId ? getCommentUrl(taskId, commentId) : getTaskUrl(taskId);
    clientUrl = getContactUrl(clientId);
    return {
      taskId,
      clientId,
      url,
      clientUrl,
      assignees,
      firstName,
      lastName,
      agencyId,
    };
  } catch (error) {
    // console.error('[leadToTask] Error:', error.message || error);
    return {
      taskId: 0,
      clientId: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof AddToLeadTaskOutputSchema>> {
  const parsedArgs = AddToLeadTaskInputSchema.parse(args);
  return addToLeadTask(parsedArgs);
}

export const planfixAddToLeadTaskTool = getToolWithHandler({
  name: "planfix_add_to_lead_task",
  description:
    "Create or update Planfix contact, task, and comment for a lead.",
  inputSchema: AddToLeadTaskInputSchema,
  outputSchema: AddToLeadTaskOutputSchema,
  handler,
});

export default planfixAddToLeadTaskTool;
