import { z } from 'zod';
import { log, planfixRequest, getToolWithHandler } from '../helpers.js';

export const ListReportsInputSchema = z.object({});

export const ListReportsOutputSchema = z.object({
  reports: z.array(z.object({
    id: z.number(),
    name: z.string(),
  })),
});

// Interface for the Planfix API response
interface ReportListResponse {
  result: string;
  reports: Array<{
    id: number;
    name: string;
  }>;
  message?: string;
}

export async function listReports(): Promise<z.infer<typeof ListReportsOutputSchema>> {
  try {
    const result = await planfixRequest(`report/list`, {
      offset: 0,
      pageSize: 100,
      fields: 'id,name'
    }) as ReportListResponse;

    return {
      reports: result.reports || []
    };
  } catch (error: any) {
    log(`[listReports] Error: ${error.message}`);
    return {
      reports: [],
      error: `Error listing reports: ${error.message}`
    } as any;
  }
}

export function handler() {
  return listReports();
}

export const planfixReportsListTool = getToolWithHandler({
  name: 'planfix_reports_list',
  description: 'List all available reports in Planfix with their IDs and names',
  inputSchema: ListReportsInputSchema,
  outputSchema: ListReportsOutputSchema,
  handler,
});

export default planfixReportsListTool;
