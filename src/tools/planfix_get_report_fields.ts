import { z } from 'zod';
import { getToolWithHandler, log, planfixRequest } from '../helpers.js';

export const GetReportFieldsInputSchema = z.object({
  reportId: z.number(),
});

export const GetReportFieldsOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  fields: z.array(z.object({
    id: z.number(),
    num: z.number(),
    name: z.string(),
    formula: z.string(),
    hidden: z.boolean(),
  })),
  error: z.string().optional(),
});

interface ReportFieldsResponse {
  result: string;
  repost: {
    id: number;
    name: string;
    fields: Array<{
      id: number;
      num: number;
      name: string;
      formula: string;
      hidden: boolean;
    }>;
  };
  message?: string;
}

/**
 * Get fields of a specific report in Planfix
 * @param reportId - The ID of the report to get fields for
 * @returns Object containing report ID, name, and fields array
 */
export async function getReportFields(
  { reportId }: z.infer<typeof GetReportFieldsInputSchema>
): Promise<z.infer<typeof GetReportFieldsOutputSchema>> {
  try {
    const result = await planfixRequest<ReportFieldsResponse>(
      `report/${reportId}`, 
      { fields: 'id,name,fields' },
      'GET'
    );

    if (result.result !== 'success' || !result.repost) {
      throw new Error(result.message || 'Failed to fetch report fields');
    }

    const report = result.repost;

    return {
      id: report.id,
      name: report.name,
      fields: report.fields,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[getReportFields] Error: ${errorMessage}`);
    return {
      id: reportId,
      name: '',
      fields: [],
      error: `Error getting report fields: ${errorMessage}`,
    };
  }
}

const handler = getReportFields;

export const planfixGetReportFieldsTool = getToolWithHandler({
  name: 'planfix_get_report_fields',
  description: 'Get fields of a specific report in Planfix',
  inputSchema: GetReportFieldsInputSchema,
  outputSchema: GetReportFieldsOutputSchema,
  handler,
});

export default planfixGetReportFieldsTool;
