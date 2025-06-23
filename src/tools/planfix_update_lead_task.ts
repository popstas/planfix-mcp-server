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

export const UpdateLeadTaskInputSchema = LeadTaskBaseSchema.extend({
  taskId: z.number(),
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
}: z.infer<typeof UpdateLeadTaskInputSchema>): Promise<
  z.infer<typeof UpdateLeadTaskOutputSchema>
> {
  const TEMPLATE_ID = Number(process.env.PLANFIX_LEAD_TEMPLATE_ID);
  const postBody: TaskRequestBody = {
    template: {
      id: TEMPLATE_ID,
    },
    // name: name || "",
    // description: description.replace(/\n/g, "<br>"),
    customFieldData: [],
  };

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
      postBody.customFieldData.push({
        field: { id: PLANFIX_FIELD_IDS.manager },
        value: { id: managerId },
      });
    } else {
      postBody.assignees = { users: [{ id: `user:${managerId}` }] };
    }
  }

  if (project) {
    const projectResult = await searchProject({ name: project });
    if (projectResult.found) {
      postBody.project = { id: projectResult.projectId };
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
        leadSource
      );
      if (entryId) {
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
        pipeline
      );

      if (entryId) {
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
      for (const tag of tags) {
        let id = await searchDirectoryEntryById(
          directoryId,
          directoryFieldId,
          tag
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
      log(`[DRY RUN] Would update lead task ${taskId}`);
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
  args?: Record<string, unknown>
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
