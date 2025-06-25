import { z } from "zod";
import { PLANFIX_DRY_RUN, PLANFIX_FIELD_IDS } from "../config.js";
import {
  getTaskUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import { searchProject } from "./planfix_search_project.js";
import { getFieldDirectoryId } from "../lib/planfixObjects.js";
import {
  createDirectoryEntry,
  searchDirectoryEntryById,
  getDirectoryFields,
} from "../lib/planfixDirectory.js";
import { getTaskCustomFieldName } from "../lib/planfixCustomFields.js";
import { TaskRequestBody } from "../types.js";

export const CreateLeadTaskInputSchema = z.object({
  name: z.string(),
  description: z.string(),
  clientId: z.number(),
  managerId: z.number().optional(),
  agencyId: z.number().optional(),
  project: z.string().optional(),
  leadSource: z.string().optional(),
  pipeline: z.string().optional(),
  referral: z.string().optional(),
  tags: z.array(z.string()).optional(),
  leadId: z.number().optional(),
});

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
 * @param referral - Optional name of the referral
 * @param tags - Optional array of tags
 * @returns Promise with the created task ID and URL
 */
export async function createLeadTask({
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  referral,
}: z.infer<typeof CreateLeadTaskInputSchema>): Promise<{
  taskId: number;
  url?: string;
  error?: string;
}> {
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
    const directoryId = await getFieldDirectoryId({
      objectId: TEMPLATE_ID,
      fieldId: PLANFIX_FIELD_IDS.leadSource,
    });
    if (directoryId) {
      const directoryFields = await getDirectoryFields(directoryId);
      const directoryFieldId = directoryFields?.[0]?.id || 0;
      let entryId = await searchDirectoryEntryById(
        directoryId,
        directoryFieldId,
        leadSource,
      );
      if (!entryId) {
        entryId = await createDirectoryEntry(
          directoryId,
          directoryFieldId,
          leadSource,
        );
      }

      if (entryId) {
        postBody.customFieldData.push({
          field: { id: PLANFIX_FIELD_IDS.leadSource },
          value: { id: entryId },
        });
      }
    }
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
    const directoryId = await getFieldDirectoryId({
      objectId: TEMPLATE_ID,
      fieldId: PLANFIX_FIELD_IDS.pipeline,
    });
    if (directoryId) {
      const directoryFields = await getDirectoryFields(directoryId);
      const directoryFieldId = directoryFields?.[0]?.id || 0;
      let entryId = await searchDirectoryEntryById(
        directoryId,
        directoryFieldId,
        pipeline,
      );
      if (!entryId) {
        entryId = await createDirectoryEntry(
          directoryId,
          directoryFieldId,
          pipeline,
        );
      }

      if (entryId) {
        postBody.customFieldData.push({
          field: { id: PLANFIX_FIELD_IDS.pipeline },
          value: { id: entryId },
        });
      }
    }
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
    const directoryId = await getFieldDirectoryId({
      objectId: TEMPLATE_ID,
      fieldId: PLANFIX_FIELD_IDS.tags,
    });
    if (directoryId) {
      const directoryFields = await getDirectoryFields(directoryId);
      const directoryFieldId = directoryFields?.[0]?.id || 0;
      const tagIds: number[] = [];
      for (const tag of tags) {
        let id = await searchDirectoryEntryById(
          directoryId,
          directoryFieldId,
          tag,
        );
        if (!id) {
          id = await createDirectoryEntry(directoryId, directoryFieldId, tag);
        }
        if (id) tagIds.push(id);
      }
      if (tagIds.length) {
        postBody.customFieldData.push({
          field: { id: PLANFIX_FIELD_IDS.tags },
          value: tagIds.map((id) => ({ id })),
        });
      }
    }
  }

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
