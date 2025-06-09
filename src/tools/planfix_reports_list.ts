import { z } from "zod";
import { getToolWithHandler, log, planfixRequest } from "../helpers.js";

export const ListReportsInputSchema = z.object({});

export const ListReportsOutputSchema = z.object({
  reports: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
    }),
  ),
  error: z.string().optional(),
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

export async function listReports(): Promise<
  z.infer<typeof ListReportsOutputSchema>
> {
  try {
    const result = (await planfixRequest(`report/list`, {
      offset: 0,
      pageSize: 100,
      fields: "id,name",
    })) as ReportListResponse;

    return {
      reports: result.reports || [],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[listReports] Error: ${errorMessage}`);
    return {
      reports: [],
      error: `Error listing reports: ${errorMessage}`,
    };
  }
}

export async function handler(): Promise<
  z.infer<typeof ListReportsOutputSchema>
> {
  return await listReports();
}

export const planfixReportsListTool = getToolWithHandler({
  name: "planfix_reports_list",
  description: "List all available reports in Planfix with their IDs and names",
  inputSchema: ListReportsInputSchema,
  outputSchema: ListReportsOutputSchema,
  handler,
});

export default planfixReportsListTool;
