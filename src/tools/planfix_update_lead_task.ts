import { z } from "zod";
import { PLANFIX_DRY_RUN, PLANFIX_FIELD_IDS } from "../config.js";
import {
  getTaskUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import { TaskRequestBody } from "../types.js";
import { searchProject } from "./planfix_search_project.js";
import { getFieldDirectoryId } from "../lib/planfixObjects.js";
import {
  createDirectoryEntry,
  searchDirectoryEntryById,
  getDirectoryFields,
} from "../lib/planfixDirectory.js";
import { searchManager } from "./planfix_search_manager.js";
import { LeadTaskBaseSchema } from "./schemas/leadTaskSchemas.js";
import type { CustomFieldDataType } from "../types.js";

interface TaskResponse {
  id: number;
  project?: { id: number };
  assignees?: { users?: Array<{ id: string }> };
  customFieldData?: CustomFieldDataType[];
}

export const UpdateLeadTaskInputSchema = LeadTaskBaseSchema.extend({
  taskId: z.number(),
  forceUpdate: z.boolean().optional(),
});

export const UpdateLeadTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string().optional(),
  error: z.string().optional(),
});

export async function updateLeadTask({
  taskId,
  name,
  description,
  managerEmail,
  project,
  leadSource,
  pipeline,
  // ignore referral
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  referral,
  tags,
  forceUpdate,
}: z.infer<typeof UpdateLeadTaskInputSchema>): Promise<
  z.infer<typeof UpdateLeadTaskOutputSchema>
> {
  const TEMPLATE_ID = Number(process.env.PLANFIX_LEAD_TEMPLATE_ID);
  const postBody: TaskRequestBody = {
    template: {
      id: TEMPLATE_ID,
    },
    customFieldData: [],
  };

  try {
    if (PLANFIX_DRY_RUN) {
      log(`[DRY RUN] Would update lead task ${taskId}`);
      return { taskId, url: getTaskUrl(taskId) };
    }

    const fields = "id,project,assignees,customFieldData";
    const { task } = await planfixRequest<{ task: TaskResponse }>({
      path: `task/${taskId}`,
      body: { fields },
      method: "GET",
    });

    if (name) {
      console.log("name is not updated");
    }

    if (description) {
      console.log("description is not updated");
    }

    let managerId = 0;
    if (managerEmail) {
      const managerResult = await searchManager({ email: managerEmail });
      managerId = managerResult.managerId;
    }
    if (managerId) {
      if (PLANFIX_FIELD_IDS.manager) {
        const managerField = task.customFieldData?.find(
          (f) => f.field.id === PLANFIX_FIELD_IDS.manager,
        );
        const currentId =
          managerField && typeof managerField.value === "object"
            ? Number((managerField.value as { id: number }).id)
            : 0;
        if ((forceUpdate || !currentId) && managerId !== currentId) {
          postBody.customFieldData.push({
            field: { id: PLANFIX_FIELD_IDS.manager },
            value: { id: managerId },
          });
        }
      } else {
        const currentUsers = task.assignees?.users || [];
        const exists = currentUsers.some((u) => u.id === `user:${managerId}`);
        if (forceUpdate || !exists) {
          postBody.assignees = { users: [{ id: `user:${managerId}` }] };
        }
      }
    }

    if (project) {
      const projectResult = await searchProject({ name: project });
      if (projectResult.found) {
        const currentProjectId = task.project?.id || 0;
        if (
          (forceUpdate || !currentProjectId) &&
          projectResult.projectId !== currentProjectId
        ) {
          postBody.project = { id: projectResult.projectId };
        }
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
        const entryId = await searchDirectoryEntryById(
          directoryId,
          directoryFieldId,
          leadSource,
        );
        const currentLeadSource = task.customFieldData?.find(
          (f) => f.field.id === PLANFIX_FIELD_IDS.leadSource,
        );
        const currentId =
          currentLeadSource && typeof currentLeadSource.value === "object"
            ? Number((currentLeadSource.value as { id: number }).id)
            : 0;
        if (entryId && (forceUpdate || !currentId) && entryId !== currentId) {
          postBody.customFieldData.push({
            field: { id: PLANFIX_FIELD_IDS.leadSource },
            value: { id: entryId },
          });
        }
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
        const entryId = await searchDirectoryEntryById(
          directoryId,
          directoryFieldId,
          pipeline,
        );
        const currentPipeline = task.customFieldData?.find(
          (f) => f.field.id === PLANFIX_FIELD_IDS.pipeline,
        );
        const currentId =
          currentPipeline && typeof currentPipeline.value === "object"
            ? Number((currentPipeline.value as { id: number }).id)
            : 0;
        if (entryId && (forceUpdate || !currentId) && entryId !== currentId) {
          postBody.customFieldData.push({
            field: { id: PLANFIX_FIELD_IDS.pipeline },
            value: { id: entryId },
          });
        }
      }
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
        const tagsField = task.customFieldData?.find(
          (f) => f.field.id === PLANFIX_FIELD_IDS.tags,
        );
        const hasTags =
          Array.isArray(tagsField?.value) &&
          (tagsField?.value as { id: number }[]).length > 0;
        if (!forceUpdate && hasTags) {
          // skip updating tags if already set
        } else {
          for (const tag of tags) {
            let id = await searchDirectoryEntryById(
              directoryId,
              directoryFieldId,
              tag,
            );
            if (!id) {
              id = await createDirectoryEntry(
                directoryId,
                directoryFieldId,
                tag,
              );
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
    }

    const hasUpdates =
      postBody.project ||
      postBody.assignees ||
      postBody.customFieldData.length > 0;

    if (!hasUpdates) {
      return { taskId, url: getTaskUrl(taskId) };
    }

    await planfixRequest({
      path: `task/${taskId}`,
      body: postBody as unknown as Record<string, unknown>,
    });
    return { taskId, url: getTaskUrl(taskId) };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[updateLeadTask] Error: ${errorMessage}`);
    return { taskId: 0, error: errorMessage };
  }
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof UpdateLeadTaskOutputSchema>> {
  const parsedArgs = UpdateLeadTaskInputSchema.parse(args);
  return updateLeadTask(parsedArgs);
}

export const planfixUpdateLeadTaskTool = getToolWithHandler({
  name: "planfix_update_lead_task",
  description: "Update a lead task in Planfix",
  inputSchema: UpdateLeadTaskInputSchema,
  outputSchema: UpdateLeadTaskOutputSchema,
  handler,
});

export default planfixUpdateLeadTaskTool;
