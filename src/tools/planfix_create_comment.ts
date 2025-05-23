import {z} from 'zod';
import {getToolWithHandler, log, planfixRequest} from '../helpers.js';

// Input schema for creating a comment
export const CreateCommentInputSchema = z.object({
  taskId: z.number(),
  description: z.string(),
  recipients: z.object({
    users: z.array(z.object({
      id: z.string(),
      name: z.string().optional(),
    })).optional(),
    groups: z.array(z.object({
      id: z.string(),
      name: z.string().optional(),
    })).optional(),
  }).optional(),
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
                                      recipients
                                    }: z.infer<typeof CreateCommentInputSchema>): Promise<{
  commentId: number;
  error?: string
}> {
  try {
    const postBody = {
      description: description.replace(/\n/g, '<br>'),
      recipients,
    } as const;

    const result = await planfixRequest<{ id: number }>(`task/${taskId}/comments/`, postBody);
    return {commentId: result.id};
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[createComment] Error: ${errorMessage}`);
    return {
      commentId: 0,
      error: `Error creating comment: ${errorMessage}`
    };
  }
}

export async function handler(args?: Record<string, unknown>): Promise<z.infer<typeof CreateCommentOutputSchema>> {
  const parsedArgs = CreateCommentInputSchema.parse(args);
  return await createComment(parsedArgs);
}

export const planfixCreateCommentTool = getToolWithHandler({
  name: 'planfix_create_comment',
  description: 'Create a comment for a task in Planfix',
  inputSchema: CreateCommentInputSchema,
  outputSchema: CreateCommentOutputSchema,
  handler,
});

export default planfixCreateCommentTool;
