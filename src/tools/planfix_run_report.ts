import {z} from 'zod';
import {getToolWithHandler, log, planfixRequest} from '../helpers.js';

export const RunReportInputSchema = z.object({
  reportId: z.number(),
});

export const RunReportOutputSchema = z.object({
  success: z.boolean(),
  rows: z.array(z.object({})).optional(),
  error: z.string().optional(),
});

type GenerateReportResponse = {
  result: string;
  requestId: string;
};

type ReportStatusResponse = {
  result: string;
  status: 'in_progress' | 'ready';
  save?: {
    id: number;
    name: string;
    reportId: number;
  };
};

type ReportRows = Array<Record<string, string>>;

interface PlanfixReportItem {
  type: string;
  items: Array<{ text: string }>;
}

type PlanfixReportData = PlanfixReportItem[];

const CACHE_TIME = 300; // 5 minutes in seconds

function reportDataToRows(data: PlanfixReportData): ReportRows {
  if (!data) return [];
  const header = data.find(row => row.type === 'Header');
  if (!header) return [];
  const fieldNames = header.items.map(item => item.text);

  return data
    .map(item => {
      if (item.type !== 'Normal') return null;
      const row: { [key: string]: string } = {};
      for (const i in fieldNames) {
        row[fieldNames[i]] = item.items[i]?.text || '';
      }
      return row;
    })
    .filter(Boolean) as ReportRows;
}

async function generateReport({reportId}: { reportId: number }): Promise<PlanfixReportData | { error: string }> {
  try {
    const generateResult = await planfixRequest(`report/${reportId}/run`, {}) as GenerateReportResponse;

    // Poll for report completion
    const maxAttempts = 10;
    const delayMs = 1000;
    let attempts = 0;
    let reportData: PlanfixReportData | undefined;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      attempts++;

      const statusResult = await planfixRequest(`report/${reportId}/status`, {
        requestId: generateResult.requestId,
      }) as ReportStatusResponse;

      if (statusResult.status === 'ready' && statusResult.save) {
        // Get the saved report data
        const dataResult = await planfixRequest(`report/${reportId}/save/${statusResult.save.id}/data`, {
          method: 'POST',
          body: JSON.stringify({
            chunks: 0,
          }),
        }) as { data: { rows: PlanfixReportData } };
        reportData = dataResult.data.rows;
        break;
      } else if (statusResult.status !== 'in_progress') {
        throw new Error(`Unexpected report status: ${statusResult.status}`);
      }
    }

    if (!reportData) {
      throw new Error('Report generation timed out');
    }

    return reportData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[generateReport] Error: ${errorMessage}`);
    return {error: errorMessage};
  }
}

async function checkSavedReport({reportId}: { reportId: number }): Promise<PlanfixReportData | undefined> {
  try {
    const data = await planfixRequest(`report/${reportId}/saves`, {}) as {
      saves: Array<{ id: number; dateTime: string }>
    };
    if (!data.saves || data.saves.length === 0) {
      return undefined;
    }

    const lastSaved = data.saves[0];
    const lastSavedTime = lastSaved.dateTime;
    const lastSavedTimeDate = new Date(lastSavedTime);
    const now = new Date();

    // Convert both times to UTC for accurate comparison
    const lastSavedUTCTime = Date.UTC(
      lastSavedTimeDate.getFullYear(),
      lastSavedTimeDate.getMonth(),
      lastSavedTimeDate.getDate(),
      lastSavedTimeDate.getHours(),
      lastSavedTimeDate.getMinutes(),
      lastSavedTimeDate.getSeconds()
    );

    const nowUTCTime = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds()
    );

    const diff = nowUTCTime - lastSavedUTCTime;

    if (diff < CACHE_TIME * 1000) {
      const dataResponse = await planfixRequest(`report/${reportId}/save/${lastSaved.id}/data`, {
        chunks: 0,
      }) as { data: { rows: PlanfixReportData } };

      return dataResponse.data.rows;
    }

    return undefined;
  } catch (error) {
    log('Exception when checking saved report: ' + (error instanceof Error ? error.message : 'Unknown error'));
    return undefined;
  }
}

export async function runReport({reportId}: z.infer<typeof RunReportInputSchema>): Promise<z.infer<typeof RunReportOutputSchema>> {
  try {
    let reportData: PlanfixReportData | undefined;

    // First, try to use a cached version if available
    const savedReportData = await checkSavedReport({reportId});
    if (savedReportData) {
      reportData = savedReportData;
    } else {
      // If no cached version, generate a new report
      const reportDataOrError = await generateReport({reportId});
      if ('error' in reportDataOrError) {
        return {success: false, error: reportDataOrError.error};
      }
      reportData = reportDataOrError;
    }

    const rows = reportDataToRows(reportData);
    return {success: true, rows};
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[runReport] Error: ${errorMessage}`);
    return {success: false, error: errorMessage};
  }
}

export async function handler(
  args?: Record<string, unknown>
): Promise<z.infer<typeof RunReportOutputSchema>> {
  const parsedArgs = RunReportInputSchema.parse(args);
  return await runReport(parsedArgs);
}

export const planfixRunReportTool = getToolWithHandler({
  name: 'planfix_run_report',
  description: 'Run a Planfix report by ID and return the report data.',
  inputSchema: RunReportInputSchema,
  outputSchema: RunReportOutputSchema,
  handler,
});

export default planfixRunReportTool;
