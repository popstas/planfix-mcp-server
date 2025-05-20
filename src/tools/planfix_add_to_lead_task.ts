import {z} from 'zod';
import {PLANFIX_ACCOUNT} from '../config.js';
import {getToolWithHandler, log} from '../helpers.js';
import {UserDataInputSchema} from '../types.js';
import {searchLeadTask} from './planfix_search_lead_task.js';
import {createPlanfixContact} from './planfix_create_contact.js';
import {createLeadTask} from './planfix_create_lead_task.js';
import {createComment} from './planfix_create_comment.js';
import {searchManager} from './planfix_search_manager.js';
import {searchPlanfixTask} from './planfix_search_task.js';

export const AddToLeadTaskInputSchema = UserDataInputSchema.extend({
  header: z.string(),
  message: z.string(),
  managerEmail: z.string().optional(),
});


const BaseOutputSchema = z.object({
  taskId: z.number(),
  clientId: z.number(),
  url: z.string().optional(),
  clientUrl: z.string().optional(),
  assignees: z.object({
    users: z.array(z.object({
      id: z.string(),
      name: z.string().optional(),
    })).optional(),
    groups: z.array(z.object({
      id: z.string(),
      name: z.string().optional(),
    })).optional(),
  }).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  agencyId: z.number().optional(),
});

export const AddToLeadTaskOutputSchema = z.union([
  BaseOutputSchema,
  z.object({
    error: z.string(),
    taskId: z.number().optional(),
  })
]);

// Helper: generate description for the task/comment
function generateDescription(userData: z.infer<typeof UserDataInputSchema>, eventData: {
  header?: string;
  message?: string
}): string {
  // Simple userData labels for Russian output
  const userDataLabels: Record<string, string> = {
    name: 'Имя',
    phone: 'Телефон',
    email: 'Email',
    telegram: 'Telegram',
  };
  if (eventData?.header) {
    return [
      eventData.header,
      '',
      eventData.message ? eventData.message : '',
    ].join('\n');
  }
  if (!userData) {
    return `Заявка от ${new Date().toLocaleString()}`;
  }
  const lines = [];
  for (const key of Object.keys(userData)) {
    if (userData[key as keyof typeof userData] && userDataLabels[key]) {
      lines.push(`${userDataLabels[key]}: ${userData[key as keyof typeof userData]}`);
    }
  }
  return lines.join('\n');
}

/**
 * Adds content to an existing lead task in Planfix
 * @param params - Parameters including leadTaskId and content to add
 * @returns Promise with the result of the operation
 */
export async function addToLeadTask({
                                      name,
                                      phone,
                                      email,
                                      telegram,
                                      company,
                                      header,
                                      message,
                                      managerEmail
                                    }: z.infer<typeof AddToLeadTaskInputSchema>): Promise<z.infer<typeof AddToLeadTaskOutputSchema> | {
  error: string
}> {
  // Helper: template string replacement
  function replaceTemplateVars(template: string, vars: Record<string, string | undefined>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value ?? '');
    }
    return result;
  }

  const userData = {name, phone, email, telegram, company};
  const eventData = {header, message};
  // Main logic

  try {
    // 1. Try to get taskId and clientId
    const searchResult = await searchLeadTask(userData);
    // Variables that might be reassigned later
    let {taskId, clientId, url, clientUrl, assignees} = searchResult;
    // Variables that won't be reassigned
    const {firstName, lastName, agencyId} = searchResult;
    const taskNameTemplate = '{clientName} - работа с клиентом';

    const description = generateDescription(userData, eventData);
    if (!description) {
      // console.log('[leadToTask] No description to send, skip create client or task');
      return {taskId, clientId, url, clientUrl};
    }

    // 2. If contact not found, create it
    if (!clientId) {
      // console.log('[leadToTask] Creating contact...');
      if (!userData.name) {
        const nowDatetime = new Date().toLocaleString();
        userData.name = userData.telegram ? userData.telegram : `Клиент ${nowDatetime}`;
      }
      const createResult = await createPlanfixContact(userData);
      clientId = createResult.contactId || 0;
    }
    // 3. If task not found and name has space, search by name
    if (clientId && !taskId && userData.name && userData.name.includes(' ')) {
      // console.log('[leadToTask] Searching for task by name...');
      const result = await searchPlanfixTask({taskName: replaceTemplateVars(taskNameTemplate, {clientName: userData.name})});
      taskId = result.taskId || 0;
      assignees = result.assignees;
    }
    // 4. If still no task, create it
    if (!taskId) {
      // console.log('[leadToTask] Creating task...');
      assignees = {users: []};
      let managerId: number | null = null;
      if (managerEmail) {
        const managerResult = await searchManager({email: managerEmail});
        managerId = managerResult.managerId;
      }
      const createLeadTaskResult = await createLeadTask({
        name: replaceTemplateVars(taskNameTemplate, {clientName: userData.name}),
        description,
        clientId,
        managerId: managerId ?? undefined,
        agencyId,
      });
      taskId = createLeadTaskResult.taskId || 0;
      if (managerId) {
        assignees.users = [{id: `user:${managerId}`}];
      }
    } else {
      // 5. If task found, add comment
      // console.log('[leadToTask] Creating comment in found task...');
      const commentResult = await createComment({
        taskId,
        description,
        recipients: assignees,
      });
      if (commentResult.commentId) {
        log(`[leadToTask] Comment created with ID: ${commentResult.commentId}`);
      }
    }
    url = taskId ? `https://${PLANFIX_ACCOUNT}.planfix.com/task/${taskId}` : '';
    clientUrl = clientId ? `https://${PLANFIX_ACCOUNT}.planfix.com/contact/${clientId}` : '';
    return {taskId, clientId, url, clientUrl, assignees, firstName, lastName, agencyId};
  } catch (error) {
    // console.error('[leadToTask] Error:', error.message || error);
    return {taskId: 0, error: error instanceof Error ? error.message : 'Unknown error'};
  }
}

export async function handler(
  args?: Record<string, unknown>
): Promise<z.infer<typeof AddToLeadTaskOutputSchema> | { error: string }> {
  const parsedArgs = AddToLeadTaskInputSchema.parse(args);
  return addToLeadTask(parsedArgs);
}

export const planfixAddToLeadTaskTool = getToolWithHandler({
  name: 'planfix_add_to_lead_task',
  description: 'Create or update Planfix contact, task, and comment for a lead.',
  inputSchema: AddToLeadTaskInputSchema,
  outputSchema: AddToLeadTaskOutputSchema,
  handler,
});

export default planfixAddToLeadTaskTool;