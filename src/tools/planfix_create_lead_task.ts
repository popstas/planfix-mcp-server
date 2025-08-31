import { z } from "zod";
import { PLANFIX_DRY_RUN, PLANFIX_FIELD_IDS } from "../config.js";
import {
  getTaskUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import { searchProject } from "./planfix_search_project.js";
import {
  addDirectoryEntry,
  addDirectoryEntries,
} from "../lib/planfixDirectory.js";
import { getTaskCustomFieldName } from "../lib/planfixCustomFields.js";
import { TaskRequestBody } from "../types.js";
import { customFieldsConfig, chatApiConfig } from "../customFieldsConfig.js";
import { extendSchemaWithCustomFields } from "../lib/extendSchemaWithCustomFields.js";
import { extendPostBodyWithCustomFields } from "../lib/extendPostBodyWithCustomFields.js";
import {
  chatApiRequest,
  ChatApiChatResponse,
  ChatApiNumberResponse,
  getChatId,
} from "../chatApi.js";
import { updateLeadTask } from "./planfix_update_lead_task.js";
import { updatePlanfixContact } from "./planfix_update_contact.js";

const CreateLeadTaskInputSchemaBase = z.object({
  name: z.string().optional().describe("Name of the task"),
  description: z.string(),
  clientId: z.number(),
  managerId: z.number().optional(),
  agencyId: z.number().optional(),
  project: z.string().optional(),
  leadSource: z.string().optional(),
  pipeline: z.string().optional(),
  tags: z.array(z.string()).optional(),
  leadId: z.number().optional(),
  message: z.string().optional().describe("Initial message text for chat"),
  contactName: z.string().optional().describe("Name of the contact"),
  email: z.string().optional(),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  instagram: z.string().optional(),
});

export const CreateLeadTaskInputSchema = extendSchemaWithCustomFields(
  CreateLeadTaskInputSchemaBase,
  customFieldsConfig.leadTaskFields,
);

export const CreateLeadTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Create a new lead task in Planfix
 * @param name - The name of the task
 * @param description - The description of the task
 * @param clientId - The ID of the client
 * @param managerId - Optional ID of the manager
 * @param agencyId - Optional ID of the agency
 * @param project - Optional name of the project
 * @param leadSource - Optional name of the lead source
 * @param tags - Optional array of tags
 * @returns Promise with the created task ID and URL
 */
export async function createLeadTask(
  args: z.infer<typeof CreateLeadTaskInputSchema>,
): Promise<{
  taskId: number;
  url?: string;
  error?: string;
}> {
  const {
    name,
    description,
    clientId,
    managerId,
    agencyId,
    project,
    leadSource,
    pipeline,
    leadId,
    tags,
    message,
  } = args;
  if (chatApiConfig.useChatApi) {
    const chatId = getChatId(args);
    const chatParams = {
      chatId,
      contactId: clientId,
      title: name,
      message: description || message,
    };
    try {
      await chatApiRequest<ChatApiChatResponse>(
        "newMessage",
        chatParams,
      );
      const data = await chatApiRequest<ChatApiNumberResponse>("getTask", {
        chatId,
      });
      const taskId = data.number;
      await updateLeadTask({ ...(args as Record<string, unknown>), taskId });
      const contactArgs: Record<string, unknown> = {
        ...(args as Record<string, unknown>),
        contactId: clientId,
        name,
      };
      delete contactArgs.name;
      delete contactArgs.message;
      await updatePlanfixContact(
        contactArgs as Parameters<typeof updatePlanfixContact>[0],
      );
      return { taskId, url: getTaskUrl(taskId) };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return { taskId: 0, error: errorMessage };
    }
  }
  const TEMPLATE_ID = Number(process.env.PLANFIX_LEAD_TEMPLATE_ID);
  let finalDescription = description;
  let finalProjectId = 0;

  if (project) {
    const projectResult = await searchProject({ name: project });
    if (projectResult.found) {
      finalProjectId = projectResult.projectId;
    } else {
      finalDescription = `${finalDescription}\nПроект: ${project}`;
    }
  }

  finalDescription = finalDescription.replace(/\n/g, "<br>");

  const postBody: TaskRequestBody = {
    template: {
      id: TEMPLATE_ID,
    },
    name,
    description: finalDescription,
    customFieldData: [
      {
        field: {
          id: PLANFIX_FIELD_IDS.client,
        },
        value: {
          id: clientId,
        },
      },
    ],
  };

  if (finalProjectId) {
    postBody.project = { id: finalProjectId };
  }

  if (managerId) {
    if (PLANFIX_FIELD_IDS.manager) {
      postBody.customFieldData.push({
        field: { id: PLANFIX_FIELD_IDS.manager },
        value: { id: managerId },
      });
    } else {
      postBody.assignees = { users: [{ id: `user:${managerId}` }] };
    }
  }

  if (leadSource) {
    await addDirectoryEntry({
      objectId: TEMPLATE_ID,
      fieldId: PLANFIX_FIELD_IDS.leadSource,
      value: leadSource,
      postBody,
    });
  } else {
    const leadSourceValue = Number(
      process.env.PLANFIX_FIELD_ID_LEAD_SOURCE_VALUE,
    );
    if (leadSourceValue) {
      postBody.customFieldData.push({
        field: { id: PLANFIX_FIELD_IDS.leadSource },
        value: { id: leadSourceValue },
      });
    }
  }

  if (pipeline) {
    await addDirectoryEntry({
      objectId: TEMPLATE_ID,
      fieldId: PLANFIX_FIELD_IDS.pipeline,
      value: pipeline,
      postBody,
    });
  }

  if (leadId && PLANFIX_FIELD_IDS.leadId) {
    postBody.customFieldData.push({
      field: { id: PLANFIX_FIELD_IDS.leadId },
      value: leadId,
    });
  }

  if (agencyId) {
    postBody.customFieldData.push({
      field: { id: PLANFIX_FIELD_IDS.agency },
      value: { id: agencyId },
    });
  }

  if (tags?.length && PLANFIX_FIELD_IDS.tags && !PLANFIX_DRY_RUN) {
    await addDirectoryEntries({
      objectId: TEMPLATE_ID,
      fieldId: PLANFIX_FIELD_IDS.tags,
      values: tags,
      postBody,
    });
  }

  await extendPostBodyWithCustomFields(
    postBody,
    args as Record<string, unknown>,
    customFieldsConfig.leadTaskFields,
  );

  try {
    if (PLANFIX_DRY_RUN) {
      const mockId = 55500000 + Math.floor(Math.random() * 10000);
      log(`[DRY RUN] Would create lead task: ${name}`);
      return { taskId: mockId, url: `https://example.com/task/${mockId}` };
    }

    const result = await planfixRequest<{ id: number }>({
      path: `task/`,
      body: postBody as unknown as Record<string, unknown>,
    });
    const taskId = result.id;
    const url = getTaskUrl(taskId);

    return { taskId, url };
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : "Unknown error";
    const match = /custom_field_is_required, id (\d+)/i.exec(errorMessage);
    if (match) {
      try {
        const fieldId = Number(match[1]);
        const fieldName = await getTaskCustomFieldName(fieldId);
        if (fieldName) {
          errorMessage += `, name: ${fieldName}`;
        }
      } catch (e) {
        log(
          `[createLeadTask] Failed to get field name: ${(e as Error).message}`,
        );
      }
    }
    log(`[createLeadTask] Error: ${errorMessage}`);
    const requestStr = JSON.stringify(postBody);
    return {
      taskId: 0,
      error: `Error creating task: ${errorMessage}, request: ${requestStr}`,
    };
  }
}

export async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof CreateLeadTaskOutputSchema>> {
  const parsedArgs = CreateLeadTaskInputSchema.parse(args);
  return await createLeadTask(parsedArgs);
}

export const planfixCreateLeadTaskTool = getToolWithHandler({
  name: "planfix_create_lead_task",
  description: "Create a new lead task in Planfix",
  inputSchema: CreateLeadTaskInputSchema,
  outputSchema: CreateLeadTaskOutputSchema,
  handler,
});

export default planfixCreateLeadTaskTool;
