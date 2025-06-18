import { z } from "zod";
import { getToolWithHandler, log, planfixRequest } from "../helpers.js";
import { PLANFIX_DRY_RUN } from "../config.js";

// Input schema for creating a comment
export const CreateCommentInputSchema = z.object({
  taskId: z.number(),
  description: z.string(),
  recipients: z
    .object({
      users: z
        .array(
          z.object({
            id: z.string(), // "user:1"
          })
        )
        .optional(),
      groups: z
        .array(
          z.object({
            id: z.number(), // 1
          })
        )
        .optional(),
      roles: z.array(z.string()).optional(), // assignee, participant, auditor, assigner
    })
    .optional(),
  silent: z.boolean().optional().describe("Don't notify recipients"),
});

// Output schema for the created comment
export const CreateCommentOutputSchema = z.object({
  commentId: z.number(),
  url: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Create a comment for a task in Planfix
 * @param taskId - The ID of the task to comment on
 * @param description - The comment text
 * @param recipients - Optional array of user IDs to mention in the comment
 * @returns Promise with the created comment ID and URL
 */
export async function createComment({
  taskId,
  description,
  recipients,
  silent,
}: z.infer<typeof CreateCommentInputSchema>): Promise<{
  commentId: number;
  error?: string;
}> {
  try {
    if (PLANFIX_DRY_RUN) {
      const mockId = 55500000 + Math.floor(Math.random() * 10000);
      log(
        `[DRY RUN] Would create comment for task ${taskId} with description: ${description}`
      );
      return { commentId: mockId };
    }

    if (silent) recipients = undefined;
    else if (!recipients) recipients = { roles: ["assignee"] };

    const postBody = {
      description: description.replace(/\n/g, "<br>"),
      recipients,
    } as const;

    const result = await planfixRequest<{ id: number }>({
      path: `task/${taskId}/comments/`,
      body: postBody,
    });
    return { commentId: result.id };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[createComment] Error: ${errorMessage}`);
    return {
      commentId: 0,
      error: `Error creating comment: ${errorMessage}`,
    };
  }
}

export async function handler(
  args?: Record<string, unknown>
): Promise<z.infer<typeof CreateCommentOutputSchema>> {
  const parsedArgs = CreateCommentInputSchema.parse(args);
  return await createComment(parsedArgs);
}

export const planfixCreateCommentTool = getToolWithHandler({
  name: "planfix_create_comment",
  description: "Create a comment for a task in Planfix",
  inputSchema: CreateCommentInputSchema,
  outputSchema: CreateCommentOutputSchema,
  handler,
});

export default planfixCreateCommentTool;
