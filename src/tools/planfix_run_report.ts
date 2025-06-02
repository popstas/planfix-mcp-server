import {z} from 'zod';
import {getToolWithHandler, log, planfixRequest, withCache} from '../helpers.js';

const CACHE_TIME = Number(process.env.PLANFIX_REPORTS_CACHE_TIME || 600);
const CACHE_PREFIX = 'planfix_report_';

// helper to compute ISO week number
function getISOWeek(date: Date): { year: number; week: number } {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: tmp.getUTCFullYear(), week: weekNo };
}

// process grouping and sorting of rows
export function processRows(
  rows: ReportRows,
  groupFields?: string[],
  groupPeriod?: 'day' | 'week' | 'month',
  sortFields?: string[]
): ReportRows {
  const result = rows.map(r => ({ ...r }));

  // test values, TODO: remove
  if (!groupFields && !groupPeriod && !sortFields) {
    groupFields = ['Дата публикации'];
    groupPeriod = 'day';
    sortFields = ['Задача'];
  }

  if (groupFields?.length && groupPeriod) {
    result.forEach(row => {
      groupFields.forEach(field => {
        const val = row[field];
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          if (groupPeriod === 'day') {
            row[field] = d.toISOString().slice(0, 10);
          } else if (groupPeriod === 'month') {
            row[field] = d.toISOString().slice(0, 7);
          } else if (groupPeriod === 'week') {
            const { year, week } = getISOWeek(d);
            row[field] = `${year}-W${week.toString().padStart(2, '0')}`;
          }
        }
      });
    });
  }

  // apply sorting, global or within groups with stable group order
  if (!sortFields?.length) {
    return result;
  }
  if (groupFields?.length && groupPeriod) {
    const keys = Array.from(
      new Set(result.map(row => groupFields.map(f => row[f]).join('|')))
    );
    const finalRows: ReportRows = [];
    for (const key of keys) {
      const groupRows = result.filter(row => groupFields.map(f => row[f]).join('|') === key);
      const sortedGroup = [...groupRows].sort((a, b) => {
        for (const field of sortFields) {
          const va = a[field] || '';
          const vb = b[field] || '';
          if (va < vb) return -1;
          if (va > vb) return 1;
        }
        return 0;
      });
      finalRows.push(...sortedGroup);
    }
    return finalRows;
  }
  // simple global sort
  return [...result].sort((a, b) => {
    for (const field of sortFields) {
      const va = a[field] || '';
      const vb = b[field] || '';
      if (va < vb) return -1;
      if (va > vb) return 1;
    }
    return 0;
  });
}

export const RunReportInputSchema = z.object({
  reportId: z.number(),
  group: z.array(z.string()).optional(),
  groupPeriod: z.enum(['day', 'week', 'month']).optional(),
  sort: z.array(z.string()).optional(),
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

async function generateReportUncached({reportId}: { reportId: number }): Promise<PlanfixReportData | { error: string }> {
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

async function generateReport({reportId}: { reportId: number }): Promise<PlanfixReportData | { error: string }> {
  const cacheKey = `${CACHE_PREFIX}${reportId}`;
  
  return withCache(cacheKey, async () => {
    // First, try to use a saved report if available
    const savedReport = await checkSavedReport({reportId});
    if (savedReport) {
      return savedReport;
    }
    
    // If no cached version, generate a new report
    return generateReportUncached({reportId});
  }, CACHE_TIME);
}

async function checkSavedReport({reportId}: { reportId: number }): Promise<PlanfixReportData | undefined> {
  try {
    const data = await planfixRequest(`report/${reportId}/save/list`, {
      offset: 0,
      pageSize: 100,
      fields: 'id,reportId,dateTime,name,chunks,chunksCount',
  }) as {
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

export async function runReport({reportId, group, groupPeriod, sort}: z.infer<typeof RunReportInputSchema>): Promise<z.infer<typeof RunReportOutputSchema>> {
  try {
    const reportDataOrError = await generateReport({reportId});
    
    if ('error' in reportDataOrError) {
      return {success: false, error: reportDataOrError.error};
    }

    const rows = reportDataToRows(reportDataOrError);
    const processedRows = processRows(rows, group, groupPeriod, sort);
    return {success: true, rows: processedRows};
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
