import { z } from 'zod';
import { getToolWithHandler, planfixRequest } from '../helpers.js';

export const PlanfixRequestInputSchema = z.object({
  method: z.enum(['GET', 'POST']).default('POST').describe('HTTP method to use for the request'),
  path: z.string().describe('API endpoint path (e.g., "contact/list")'),
  body: z.record(z.unknown()).optional().describe('Request body as planfix request object'),
});

export const PlanfixRequestOutputSchema = z.record(z.unknown());

/**
 * Make a generic request to the Planfix API.
 * This tool allows making any API call to Planfix with the specified method, path, and body.
 */
export async function planfixRequestHandler(
  { method, path, body = {} }: z.infer<typeof PlanfixRequestInputSchema>
): Promise<z.infer<typeof PlanfixRequestOutputSchema>> {
  try {
    const response = await planfixRequest(path, body, method);
    return response as Record<string, unknown>;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { 
      success: false,
      error: errorMessage,
      path,
      method,
    };
  }
}

export default getToolWithHandler({
  name: 'planfix_request',
  description: 'Make a generic request to the Planfix API with the specified method, path, and body.',
  inputSchema: PlanfixRequestInputSchema,
  outputSchema: PlanfixRequestOutputSchema,
  handler: planfixRequestHandler,
});
