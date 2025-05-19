import { z } from 'zod';
import { log, planfixRequest, getToolWithHandler } from '../helpers.js';

// Input schema for creating a comment
export const CreateCommentInputSchema = z.object({
  taskId: z.number(),
  description: z.string(),
  recipients: z.array(z.number()).optional(),
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
  commentId: number | null; 
  error?: string 
}> {
  try {
    const postBody: any = {
      description: description.replace(/\n/g, '<br>'),
      recipients,
    };

    const result = await planfixRequest(`task/${taskId}/comments/`, postBody);
    return { commentId: result.id };
  } catch (error: any) {
    log(`[createComment] Error: ${error.message}`);
    return { 
      commentId: null, 
      error: `Error creating comment: ${error.message}` 
    };
  }
}

export function handler(args?: Record<string, unknown>) {
  const parsedArgs = CreateCommentInputSchema.parse(args);
  return createComment(parsedArgs);
}

export const planfixCreateCommentTool = getToolWithHandler({
  name: 'planfix_create_comment',
  description: 'Create a comment for a task in Planfix',
  inputSchema: CreateCommentInputSchema,
  outputSchema: CreateCommentOutputSchema,
  handler,
});

export default planfixCreateCommentTool;
