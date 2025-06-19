import { z } from "zod";
import { PLANFIX_DRY_RUN, PLANFIX_FIELD_IDS } from "../config.js";
import {
  getTaskUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import type { CustomFieldDataType } from "../types.js";
import { searchProject } from "./planfix_search_project.js";
import { getFieldDirectoryId } from "../lib/planfixObjects.js";
import {
  createDirectoryEntry,
  searchDirectoryEntryById,
  getDirectoryFields,
} from "../lib/planfixDirectory.js";

export const UpdateLeadTaskInputSchema = z.object({
  taskId: z.number(),
  name: z.string().optional(),
  description: z.string().optional(),
  managerId: z.number().optional(),
  agencyId: z.number().optional(),
  project: z.string().optional(),
  leadSource: z.string().optional(),
  tags: z.array(z.string()).optional(),
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
  managerId,
  agencyId,
  project,
  leadSource,
  tags,
}: z.infer<typeof UpdateLeadTaskInputSchema>): Promise<
  z.infer<typeof UpdateLeadTaskOutputSchema>
> {
  const TEMPLATE_ID = Number(process.env.PLANFIX_LEAD_TEMPLATE_ID);
  const postBody: Record<string, unknown> = {};
  const customFieldData: CustomFieldDataType[] = [];

  if (name !== undefined) {
    postBody.name = name;
  }

  if (description !== undefined) {
    postBody.description = description.replace(/\n/g, "<br>");
  }

  if (managerId) {
    customFieldData.push({
      field: { id: PLANFIX_FIELD_IDS.manager },
      value: { id: managerId },
    });
  }

  if (agencyId) {
    customFieldData.push({
      field: { id: PLANFIX_FIELD_IDS.agency },
      value: { id: agencyId },
    });
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
      if (entryId) {
        customFieldData.push({
          field: { id: PLANFIX_FIELD_IDS.leadSource },
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
        customFieldData.push({
          field: { id: PLANFIX_FIELD_IDS.tags },
          value: tagIds.map((id) => ({ id })),
        });
      }
    }
  }

  if (customFieldData.length) {
    postBody.customFieldData = customFieldData;
  }

  if (project) {
    const projectResult = await searchProject({ name: project });
    if (projectResult.found) {
      postBody.project = { id: projectResult.projectId };
    } else if (description !== undefined) {
      postBody.description = `${postBody.description || ""}<br>Проект: ${project}`;
    }
  }

  try {
    if (PLANFIX_DRY_RUN) {
      log(`[DRY RUN] Would update lead task ${taskId}`);
      return { taskId, url: getTaskUrl(taskId) };
    }

    await planfixRequest({ path: `task/${taskId}`, body: postBody });
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
