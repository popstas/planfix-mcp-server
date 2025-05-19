import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ListToolsRequestSchema, CallToolRequestSchema, Tool, ToolSchema, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// change cwd to current file directory before load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(path.join(__dirname, '..'));
log('Starting Planfix MCP Server')

dotenv.config();

const PLANFIX_ACCOUNT = process.env.PLANFIX_ACCOUNT;
const PLANFIX_TOKEN = process.env.PLANFIX_TOKEN;
const PLANFIX_BASE_URL = `https://${PLANFIX_ACCOUNT}.planfix.com/rest/`;
const PLANFIX_HEADERS = {
  'Authorization': `Bearer ${PLANFIX_TOKEN}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
};

const PLANFIX_FIELD_IDS = {
  email: Number(process.env.PLANFIX_FIELD_ID_EMAIL),
  phone: Number(process.env.PLANFIX_FIELD_ID_PHONE),
  telegram: Number(process.env.PLANFIX_FIELD_ID_TELEGRAM),
  client: Number(process.env.PLANFIX_FIELD_ID_CLIENT),
  manager: Number(process.env.PLANFIX_FIELD_ID_MANAGER),
  agency: Number(process.env.PLANFIX_FIELD_ID_AGENCY),
};

// --- Tool Schemas ---

type CustomFieldDataType = {
  field: {
    id: number
  },
  value: string | { id: number }
}

const GetChildTasksInputSchema = z.object({
  parentTaskId: z.number(),
});

const ChildTaskSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
});

const GetChildTasksOutputSchema = z.object({
  tasks: z.array(ChildTaskSchema),
  totalCount: z.number(),
  error: z.string().optional(),
});

function log(message: string) {
  // write to data/mcp.log, format [date time] message
  const logPath = path.join(__dirname, '..', 'data', 'mcp.log');
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logPath, logMessage);
}

const CreateSellTaskInputSchema = z.object({
  clientId: z.number(),
  leadTaskId: z.number(),
  agencyId: z.number().optional(),
  assignees: z.array(z.number()).optional(),
  name: z.string(),
  description: z.string(),
});
const CreateSellTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string().optional(),
});

const UserDataInputSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  telegram: z.string().optional(),
  company: z.string().optional(),
});

const SearchLeadTaskInputSchema = UserDataInputSchema;
const SearchLeadTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string().optional(),
  clientId: z.number(),
  clientUrl: z.string().optional(),
  assignees: z.any().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  agencyId: z.number().optional(),
});
const LeadToTaskInputSchema = UserDataInputSchema.extend({
  header: z.string(),
  message: z.string(),
  managerEmail: z.string().optional(),
})
const LeadToTaskOutputSchema = SearchLeadTaskOutputSchema;

const SearchPlanfixContactInputSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  telegram: z.string().optional(),
});
const SearchPlanfixContactOutputSchema = z.object({
  contactId: z.number(),
  url: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const SearchPlanfixCompanyInputSchema = z.object({
  name: z.string().optional(),
});
const SearchPlanfixCompanyOutputSchema = z.object({
  contactId: z.number(),
  url: z.string().optional(),
  name: z.string().optional(),
});

const CreatePlanfixContactInputSchema = SearchPlanfixContactInputSchema;
const CreatePlanfixContactOutputSchema = z.object({
  contactId: z.number(),
  url: z.string().optional(),
});

const SearchManagerInputSchema = z.object({
  email: z.string(),
});
const SearchManagerOutputSchema = z.object({
  managerId: z.number(),
  url: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const SearchPlanfixTaskInputSchema = z.object({
  taskName: z.string(),
  clientId: z.number(),
});
const SearchPlanfixTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string().optional(),
});

const CreateLeadTaskInputSchema = z.object({
  name: z.string(),
  description: z.string(),
  clientId: z.number(),
});
const CreateLeadTaskOutputSchema = z.object({
  taskId: z.number(),
  url: z.string().optional(),
});

const CreateCommentInputSchema = z.object({
  taskId: z.number(),
  description: z.string(),
  recipients: z.array(z.number()).optional(),
});
const CreateCommentOutputSchema = z.object({
  commentId: z.number(),
  url: z.string().optional(),
});

const ListReportsInputSchema = z.object({});
const ListReportsOutputSchema = z.object({
  reports: z.array(z.object({
    id: z.number(),
    name: z.string(),
  })),
});
// --- Tool Implementations ---

// --- Report Generation Types and Functions ---

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

type ReportRows = {[key: string]: string}[];
type PlanfixReportData = { type: string; items: { text: string }[] }[];

const RunReportInputSchema = z.object({
  reportId: z.number(),
});

const RunReportOutputSchema = z.object({
  success: z.boolean(),
  rows: z.array(z.object({})).optional(),
  error: z.string().optional(),
});

function reportDataToRows(data: PlanfixReportData): ReportRows {
  if (!data) return [];
  const header = data.find(row => row.type === 'Header');
  if (!header) return [];
  const fieldNames = header.items.map(item => item.text);

  return data.map(item => {
    const row = {} as { [key: string]: string };
    if (item.type !== 'Normal') return;

    for (const i in fieldNames) {
      const fieldName = fieldNames[i];
      row[fieldName] = item.items[i].text;
    }

    return row;
  }).filter(Boolean) as { [key: string]: string }[] || [];
}

async function generateReport({ reportId }: z.infer<typeof RunReportInputSchema>): Promise<PlanfixReportData | {error: string}> {
  const MAX_RETRIES = 24; // 24 retries * 5 seconds = 120 seconds max
  const RETRY_DELAY = 5000; // 5 seconds
  
  try {
    // Step 1: Generate the report
    const generateResponse = await fetch(`${PLANFIX_BASE_URL}report/${reportId}/generate`, {
      method: 'POST',
      headers: PLANFIX_HEADERS as any,
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      return {error: `Failed to generate report: ${generateResponse.status} - ${errorText}`};
    }

    const generateResult = await generateResponse.json() as GenerateReportResponse;
    const requestId = generateResult.requestId;

    if (!requestId) {
      throw new Error('No requestId received in generate report response');
    }

    // Step 2: Poll for report status
    let retries = 0;
    let saveId: number | null = null;

    while (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      
      const statusResponse = await fetch(`${PLANFIX_BASE_URL}report/status/${requestId}`, {
        method: 'GET',
        headers: PLANFIX_HEADERS as any,
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(`Failed to get report status: ${statusResponse.status} - ${errorText}`);
      }

      const statusResult = await statusResponse.json() as ReportStatusResponse;

      if (statusResult.status === 'ready') {
        if (statusResult.save?.id) {
          saveId = statusResult.save.id;
          break;
        }
        throw new Error('Report ready but no save ID received');
      } else if (statusResult.status !== 'in_progress') {
        throw new Error(`Unexpected report status: ${statusResult.status}`);
      }

      retries++;
    }

    if (!saveId) {
      throw new Error('Report generation timed out');
    }

    // Step 3: Get the report data
    const dataResponse = await fetch(`${PLANFIX_BASE_URL}report/${reportId}/save/${saveId}/data`, {
      method: 'POST',
      headers: PLANFIX_HEADERS as any,
    });

    if (!dataResponse.ok) {
      const errorText = await dataResponse.text();
      throw new Error(`Failed to get report data: ${dataResponse.status} - ${errorText}`);
    }

    const reportRows = await dataResponse.json() as {data: {rows: PlanfixReportData}};
    return reportRows.data.rows;
  } catch (error: any) {
    console.error('Error running report:', error);
    return error.message || 'Unknown error occurred';
  }
}

// return report data when exists saved report for last CACHE_TIME seconds
async function checkSavedReport({ reportId }: z.infer<typeof RunReportInputSchema>): Promise<PlanfixReportData | undefined> {
  const CACHE_TIME = 600;
  try {
    const params = {
      offset: 0,
      pageSize: 100,
      fields: 'id,reportId,dateTime,name,chunks,chunksCount',
    };

    const response = await fetch(`${PLANFIX_BASE_URL}report/${reportId}/save/list`, {
      method: 'POST',
      headers: PLANFIX_HEADERS as any,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to check saved report: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      result: string,
      saves: {
        id: number;
        name: string;
        reportId: number;
        dateTime: string;
        chunks: number;
        chunksCount: number;
      }[];
    };

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
      /*
      // get report save data
      const answer = await planfixRest(`report/${reportId}/save/${lastSave.id}/data`, {
        chunks: 0,
      });

      return this.reportDataToRows(answer.data.data.rows);
       */

      const response = await fetch(`${PLANFIX_BASE_URL}report/${reportId}/save/${lastSaved.id}/data`, {
        method: 'POST',
        headers: PLANFIX_HEADERS as any,
        body: JSON.stringify({
          chunks: 0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get report data: ${response.status} - ${errorText}`);
      }

      const answer = await response.json() as {data: {rows: PlanfixReportData}};
      const reportRows = answer.data.rows;
      return reportRows;
    }
    
    return undefined;
  } catch (error) {
    console.error('Exception when checking saved report:', error);
    return undefined;
  }
}
async function runReport({ reportId }: z.infer<typeof RunReportInputSchema>): Promise<z.infer<typeof RunReportOutputSchema>> {
  try {
    let reportData = {} as PlanfixReportData;
    const savedReportData = await checkSavedReport({ reportId });
    if (savedReportData) {
      reportData = savedReportData;
    }
    else {
      const reportDataOrError = await generateReport({ reportId });
      if ('error' in reportDataOrError) {
        return { success: false, error: reportDataOrError.error };
      }
      reportData = reportDataOrError;
    }
    const rows = reportDataToRows(reportData);
    return { success: true, rows };
  } catch (error: any) {
    console.error('Error running report:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

interface ReportListResponse {
  result: string;
  reports: Array<{
    id: number;
    name: string;
  }>;
  message?: string;
}

const listReports = async (): Promise<z.infer<typeof ListReportsOutputSchema>> => {
  const response = await fetch(`${PLANFIX_BASE_URL}report/list`, {
    method: 'POST',
    headers: PLANFIX_HEADERS as any,
    body: JSON.stringify({
      offset: 0,
      pageSize: 100,
      fields: 'id,name'
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch reports: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as ReportListResponse;
  if (data.result !== 'success') {
    throw new Error(`Failed to fetch reports: ${data.message || 'Unknown error'}`);
  }

  return {
    reports: data.reports as {id: number; name: string}[],
  };
};

/**
 * Create a sell task in Planfix using the SELL template, with parent task set to { id: 1 }.
 * @param clientId - The Planfix client/contact ID
 * @param leadTaskId - The Planfix lead task ID (parent)
 * @returns {Promise<typeof CreateSellTaskOutputSchema>} The created task ID
 */
async function planfixCreateSellTask({ clientId, leadTaskId, agencyId, assignees, name, description }: z.infer<typeof CreateSellTaskInputSchema>): Promise<z.infer<typeof CreateSellTaskOutputSchema>> {
  try {
    const TEMPLATE_ID = Number(process.env.PLANFIX_SELL_TEMPLATE_ID);
    if (!name) name = 'Продажа из бота';
    if (!description) description = 'Задача продажи для клиента';
    description = description.replace(/\n/g, '<br>');

    const postBody: any = {
      template: {
        id: TEMPLATE_ID,
      },
      name,
      description,
      parent: {
        id: leadTaskId,
      },
      customFieldData: [
        {
          field: {
            id: PLANFIX_FIELD_IDS.client,
          },
          value: {
            id: clientId,
          },
        },
      ],
    };

    if (assignees) {
      postBody.assignees = {
        users: assignees.map((assignee) => ({
          id: `user:${assignee}`
        }))
      };
    }
    if (agencyId) {
      postBody.customFieldData.push({
        field: {
          id: PLANFIX_FIELD_IDS.agency,
        },
        value: {
          id: agencyId,
        },
      });
    }

    const response = await fetch(`${PLANFIX_BASE_URL}task/`, {
      method: 'POST',
      headers: {
        ...PLANFIX_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postBody),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}, ${JSON.stringify(result)}`);
    }
    const resultId = (result as any).id;

    if (!result || resultId === undefined) {
      throw new Error('Invalid response format from Planfix API: Missing task ID');
    }

    const taskId = Number(resultId);
    if (isNaN(taskId) || taskId <= 0) {
      throw new Error(`Invalid task ID received: ${resultId}`);
    }

    const url = `https://${PLANFIX_ACCOUNT}.planfix.com/task/${taskId}`;
    return { taskId, url };
  } catch (error: any) {
    console.error('[planfixCreateSellTask] Error:', error.message);
    return { taskId: 0, url: '' };
  }
}

// Helper: generate description for the task/comment
function generateDescription(userData: any, eventData: any): string {
  // Simple userData labels for Russian output
  const userDataLabels: Record<string, string> = {
    name: 'Имя',
    phone: 'Телефон',
    email: 'Email',
    telegram: 'Telegram',
  };
  if (eventData?.header) {
    return [
      eventData.header,
      '',
      eventData.message ? eventData.message : '',
    ].join('\n');
  }
  if (!userData) {
    return `Заявка от ${new Date().toLocaleString()}`;
  }
  const lines = [];
  for (const key in userData) {
    if (userData[key] && userDataLabels[key]) {
      lines.push(`${userDataLabels[key]}: ${userData[key]}`);
    }
  }
  return lines.join('\n');
}

async function searchLeadTask(userData: z.infer<typeof SearchLeadTaskInputSchema>): Promise<z.infer<typeof SearchLeadTaskOutputSchema>> {
  log(`[searchLeadTask] Searching for lead task by userData: ${JSON.stringify(userData)}`);
  try {
    // 1. Search for contact
    // console.log('[leadToTask] Searching for contact...');
    let assignees = [];
    let contactResult = await searchPlanfixContact(userData);
    let clientId = contactResult.contactId;
    log(`[searchLeadTask] Contact found: ${clientId}`)
    let taskId = 0;
    // 2. If contact found, search for task by clientId
    if (clientId) {
      // console.log('[leadToTask] Contact found, searching for task by clientId...');
      const result = await searchPlanfixTask({ clientId });
      assignees = (result as any).assignees;
      taskId = result.taskId || 0;
      log(`[searchLeadTask] Task found: ${taskId}`)
    }

    let agencyId = undefined;
    if (userData.company) {
      const companyResult = await searchPlanfixCompany({ name: userData.company });
      agencyId = 'contactId' in companyResult ? companyResult.contactId : undefined;
    }
    const firstName = contactResult.firstName;
    const lastName = contactResult.lastName;
    const url = taskId ? `https://${PLANFIX_ACCOUNT}.planfix.com/task/${taskId}` : '';
    const clientUrl = clientId ? `https://${PLANFIX_ACCOUNT}.planfix.com/contact/${clientId}` : '';
    return { taskId, clientId, url, clientUrl, assignees, firstName, lastName, agencyId };
  } catch (error: any) {
    console.error('[searchLeadTask] Error:', error.message);
    return { taskId: 0, clientId: 0, url: '', clientUrl: '', assignees: [], agencyId: undefined };
  }
}

async function leadToTask({ name, phone, email, telegram, company, header, message, managerEmail }: z.infer<typeof LeadToTaskInputSchema>): Promise<z.infer<typeof LeadToTaskOutputSchema> | { error: string }> {
  // Helper: template string replacement
  function replaceTemplateVars(template: string, vars: Record<string, string | undefined>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value ?? '');
    }
    return result;
  }

  const userData = { name, phone, email, telegram, company };
  const eventData = { header, message };
  // Main logic

  try {
    // 1. Try to get taskId and clientId
    const searchResult = await searchLeadTask(userData);
    let { taskId, clientId, url, clientUrl, assignees, firstName, lastName, agencyId } = searchResult;
    const taskNameTemplate = '{clientName} - работа с клиентом';

    const description = generateDescription(userData, eventData);
    if (!description) {
      // console.log('[leadToTask] No description to send, skip create client or task');
      return { taskId, clientId, url, clientUrl };
    }

    // 2. If contact not found, create it
    if (!clientId) {
      // console.log('[leadToTask] Creating contact...');
      if (!userData.name) {
        const nowDatetime = new Date().toLocaleString();
        userData.name = userData.telegram ? userData.telegram : `Клиент ${nowDatetime}`;
      }
      const createResult = await createPlanfixContact(userData);
      clientId = createResult.contactId || 0;
    }
    // 3. If task not found and name has space, search by name
    if (clientId && !taskId && userData.name && userData.name.includes(' ')) {
      // console.log('[leadToTask] Searching for task by name...');
      const result = await searchPlanfixTask({ taskName: replaceTemplateVars(taskNameTemplate, { clientName: userData.name }) });
      taskId = result.taskId || 0;
      assignees = result.assignees;
    }
    // 4. If still no task, create it
    if (!taskId) {
      // console.log('[leadToTask] Creating task...');
      let managerId: number | null = null;
      if (managerEmail) {
        const managerResult = await searchManager({ email: managerEmail });
        managerId = managerResult.managerId;
      }
      const createLeadTaskResult = await createLeadTask({
        name: replaceTemplateVars(taskNameTemplate, { clientName: userData.name }),
        description,
        clientId,
        managerId: managerId ?? undefined,
        agencyId,
      });
      taskId = createLeadTaskResult.taskId || 0;
      if (managerId) {
        assignees = { users: [{ id: `user:${managerId}` }] };
      }
    } else {
      // 5. If task found, add comment
      // console.log('[leadToTask] Creating comment in found task...');
      const commentResult = await createComment({
        taskId,
        description,
        recipients: assignees,
      });
      if (commentResult.commentId) {
        log(`[leadToTask] Comment created with ID: ${commentResult.commentId}`);
      }
    }
    url = taskId ? `https://${PLANFIX_ACCOUNT}.planfix.com/task/${taskId}` : '';
    clientUrl = clientId ? `https://${PLANFIX_ACCOUNT}.planfix.com/contact/${clientId}` : '';
    return { taskId, clientId, url, clientUrl, firstName, lastName, agencyId };
  } catch (error: any) {
    // console.error('[leadToTask] Error:', error.message || error);
    return { taskId: 0, error: error.message || error };
  }
}

async function searchPlanfixCompany({ name }: { name?: string }): Promise<z.infer<typeof SearchPlanfixCompanyOutputSchema> | { error: string }> {
  let contactId: number | null = null;
  let companyName: string | undefined = undefined;
  const postBody: any = {
    offset: 0,
    pageSize: 100,
    isCompany: true,
    filters: [
      { type: 4006, operator: 'equal', value: true } // isCompany: true
    ],
    fields: 'id,name',
  };

  const filters = {
    byName: {
      type: 4001,
      operator: 'equal',
      value: name,
    },
  };

  async function searchWithFilter(filter: any, label: string): Promise<{ contactId: number; name?: string; error?: string }> {
    const currentFilters = [...postBody.filters, filter];
    try {
      const response = await fetch(`${PLANFIX_BASE_URL}contact/list`, {
        method: 'POST',
        headers: PLANFIX_HEADERS as any,
        body: JSON.stringify({ ...postBody, filters: currentFilters })
      });

      if (!response.ok) {
        const error = await response.text();
        return { contactId: 0, error: `HTTP error! Status: ${response.status}, ${error}` };
      }

      const answer = await response.json();
      if ((answer as any).contacts?.length > 0) {
        contactId = (answer as any).contacts[0].id;
        companyName = (answer as any).contacts[0].name;
      }
      return { contactId: contactId || 0, name: companyName };
    } catch (error: any) {
      return { contactId: 0, error: error.message };
    }
  }

  try {
    let result;
    if (!contactId && name) {
      result = await searchWithFilter(filters.byName, 'name');
      contactId = result.contactId;
    }

    contactId = contactId || 0;
    const url = contactId ? `https://${PLANFIX_ACCOUNT}.planfix.com/contact/${contactId}` : undefined;
    return { 
      contactId, 
      url, 
      name: companyName || result?.name,
      error: result?.error
    };
  } catch (error: any) {
    console.error('Error searching for company:', error.message);
    return { contactId: 0, url: undefined, error: error.message };
  }
}

async function searchPlanfixContact({ name, phone, email, telegram }: z.infer<typeof SearchPlanfixContactInputSchema>): Promise<z.infer<typeof SearchPlanfixContactOutputSchema>> {
  // console.log('Searching Planfix contact...');
  let contactId: number | null = null;
  let firstName: string | undefined = undefined;
  let lastName: string | undefined = undefined;
  const postBody: any = {
    offset: 0,
    pageSize: 100,
    filters: [],
    fields: `id,name,midname,lastname,email,phone,description,group,${PLANFIX_FIELD_IDS.telegram}`,
  };

  const filters = {
    byName: {
      type: 4001,
      operator: 'equal',
      value: name,
    },
    byPhone: {
      type: 4003,
      operator: 'equal',
      value: phone,
    },
    byEmail: {
      type: 4026,
      operator: 'equal',
      value: email,
    },
    byTelegram: {
      type: 4101,
      field: PLANFIX_FIELD_IDS.telegram,
      operator: 'have',
      value: telegram?.replace(/^@/, ''),
    },
  };

  async function searchWithFilter(filter: any, label: string): Promise<{ contactId: number; firstName?: string; lastName?: string; error?: string }> {
    postBody.filters = [filter];
    try {
      const response = await fetch(`${PLANFIX_BASE_URL}contact/list`, {
        method: 'POST',
        headers: PLANFIX_HEADERS as any,
        body: JSON.stringify(postBody)
      });
      if (!response.ok) {
        const error = await response.text();
        return { contactId: 0, error: `HTTP error! Status: ${response.status}, ${error}` };
      }
      const answer = await response.json();
      if ((answer as any).contacts && (answer as any).contacts.length > 0) {
        contactId = (answer as any).contacts[0].id;
        firstName = (answer as any).contacts[0].name;
        lastName = (answer as any).contacts[0].lastname;
      }
      contactId = contactId || 0;
      return { contactId, firstName, lastName };
    } catch (error: any) {
      // console.error('Error searching for contacts:', error.message);
      return { contactId: 0, error: error.message };
    }
  }
  try {
    let result;
    if (!contactId && email) {
      result = await searchWithFilter(filters.byEmail, 'email');
      contactId = result.contactId;
    }
    if (!contactId && phone) {
      result = await searchWithFilter(filters.byPhone, 'phone');
      contactId = result.contactId;
    }
    if (!contactId && name && name.includes(' ')) {
      result = await searchWithFilter(filters.byName, 'name');
      contactId = result.contactId;
    }
    if (!contactId && telegram) {
      result = await searchWithFilter(filters.byTelegram, 'telegram');
      contactId = result.contactId;
    }
    contactId = contactId || 0;
    const url = contactId ? `https://${PLANFIX_ACCOUNT}.planfix.com/contact/${contactId}` : undefined;
    const firstName = result?.firstName;
    const lastName = result?.lastName;
    return { contactId, url, firstName, lastName };
  } catch (error: any) {
    console.error('Error searching for contacts:', error.message);
    return { contactId: 0, url: undefined };
  }
}


function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', lastName: '' };
  }
  const nameParts = fullName.trim().split(/\s+/);
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: '' };
  } else {
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    return { firstName, lastName };
  }
}

async function createPlanfixContact(userData: { name?: string; email?: string; phone?: string; telegram?: string }): Promise<{ contactId: number; url?: string }> {
  // console.log('Creating new contact');
  try {
    const { firstName, lastName } = splitName(userData.name || '');
    const postBody: any = {
      template: {
        id: Number(process.env.PLANFIX_CONTACT_TEMPLATE_ID),
      },
      name: firstName,
      lastname: lastName,
      email: userData.email,
      phones: [],
      customFieldData: [] as CustomFieldDataType[],
    };
    // Add phone if available
    if (userData.phone) {
      postBody.phones.push({
        type: 1, // mobile
        number: userData.phone,
      });
    }
    // Add telegram if available
    if (userData.telegram) {
      postBody.customFieldData = [
        {
          field: {
            id: PLANFIX_FIELD_IDS.telegram,
          },
          value: '@' + userData.telegram.replace(/^@/, ''),
        },
      ];
    }
    const response = await fetch(`${PLANFIX_BASE_URL}contact/`, {
      method: 'POST',
      headers: PLANFIX_HEADERS as any,
      body: JSON.stringify(postBody),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, ${errorText}`);
    }
    const result = await response.json();
    // console.log(`Contact created with ID: ${result.id}`);
    const contactId = (result as any).id;
    const url = contactId ? `https://${PLANFIX_ACCOUNT}.planfix.com/contact/${contactId}` : undefined;
    return { contactId, url };
  } catch (error: any) {
    console.error('Error creating contact:', error.message);
    return { contactId: 0, url: undefined };
  }
}

type SearchManagerResult = z.infer<typeof SearchManagerOutputSchema> & { error?: string };

async function searchManager({ email }: z.infer<typeof SearchManagerInputSchema>): Promise<SearchManagerResult> {
  // console.log(`Searching for manager with email: ${email}`);
  try {
    const postBody = {
      offset: 0,
      pageSize: 100,
      fields: "id,name,midname,lastname,email",
      filters: [
        {
          type: 9003, // Filter by email
          operator: "equal",
          value: email,
        },
      ],
    };
    const response = await fetch(`${PLANFIX_BASE_URL}user/list`, {
      method: 'POST',
      headers: PLANFIX_HEADERS as any,
      body: JSON.stringify(postBody),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, ${errorText}`);
    }
    const result = await response.json();
    if ((result as any).users && (result as any).users.length > 0) {
      const managerId = (result as any).users[0].id;
      const firstName = (result as any).users[0].name;
      const lastName = (result as any).users[0].lastname;
      const url = managerId ? `https://${PLANFIX_ACCOUNT}.planfix.com/user/${managerId}` : undefined;
      return { managerId, url, firstName, lastName };
    } else {
      return { managerId: 0, url: undefined, error: `No manager found with email: ${email}`};
    }
  } catch (error: any) {
    // console.error('Error searching for manager:', error.message);
    return { managerId: 0, url: undefined, error: error.message };
  }
}


async function searchPlanfixTask({ taskName, clientId }: { taskName?: string; clientId?: number }): Promise<{ taskId: number | null; assignees?: any; url?: string; error?: string }> {
  // console.log('Searching Planfix task...');
  let taskId: number | null = null;
  let assignees: any = undefined;
  let description: string | undefined = undefined;
  
  const TEMPLATE_ID = Number(process.env.PLANFIX_LEAD_TEMPLATE_ID);
  const DAYS_TO_SEARCH = Number(process.env.PLANFIX_DAYS_TO_SEARCH) || 3;

  const postBody: any = {
    offset: 0,
    pageSize: 100,
    filters: [],
    fields: 'id,name,description,template,assignees',
  };

  const filtersDefault = [
    {
      type: 51, // filter by template
      operator: 'equal',
      value: TEMPLATE_ID,
    },
  ];

  const filters = {
    byClient: {
      type: 108,
      field: PLANFIX_FIELD_IDS.client,
      operator: 'equal',
      value: `contact:${clientId}`,
    },
    byName: {
      type: 8,
      operator: 'equal',
      value: taskName,
    },
    byLastDays: {
      type: 12, // by last days
      operator: 'greaterOrEqual',
      value: Math.floor(Date.now() / 1000) - DAYS_TO_SEARCH * 24 * 3600,
    },
  };

  async function searchWithFilter(filtersArr: any[], label: string) {
    // console.log(`search task with filter: ${label}`);
    postBody.filters = [...filtersDefault, ...filtersArr];
    try {
      const response = await fetch(`${PLANFIX_BASE_URL}task/list`, {
        method: 'POST',
        headers: PLANFIX_HEADERS as any,
        body: JSON.stringify(postBody),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const answer = await response.json();
      if ((answer as any).tasks && (answer as any).tasks.length > 0) {
        taskId = (answer as any).tasks[0].id;
        assignees = (answer as any).tasks[0].assignees;
        description = (answer as any).tasks[0].description;
        // console.log(`Task found by ${label}: ${taskId}`);
      }
      return { taskId, assignees, description };
    } catch (error: any) {
      return { taskId: 0, error: `Error searching for tasks: ${error.message}` };
    }
  }
  try {
    if (clientId) {
      const result = await searchWithFilter([filters.byClient], 'client');
      taskId = result.taskId;
      assignees = result.assignees;
      description = result.description;
    }
    if (!taskId && taskName) {
      const result = await searchWithFilter([filters.byName, filters.byLastDays], 'name');
      taskId = result.taskId;
      assignees = result.assignees;
      description = result.description;
    }
    if (taskId) {
      // console.log(`Task found: ${taskId}`);
    } else {
      // console.log('No task found');
    }
    const url = taskId ? `https://${PLANFIX_ACCOUNT}.planfix.com/task/${taskId}` : undefined;
    return { taskId, assignees, url };
  } catch (error: any) {
    return { taskId: 0, assignees: undefined, url: undefined, error: `Error searching for tasks: ${error.message}` };
  }
}


async function createLeadTask({ name, description, clientId, managerId, agencyId }: { name: string; description: string; clientId: number; managerId?: number; agencyId?: number }): Promise<{ taskId: number | null; url?: string; error?: string }> {
  // console.log('Creating new task');
  try {
    const TEMPLATE_ID = Number(process.env.PLANFIX_LEAD_TEMPLATE_ID);
    description = description.replace(/\n/g, '<br>');
    const postBody: any = {
      template: {
        id: TEMPLATE_ID,
      },
      name,
      description,
      customFieldData: [
        {
          field: {
            id: PLANFIX_FIELD_IDS.client,
          },
          value: {
            id: clientId,
          },
        },
      ],
    };
    if (managerId) {
      postBody.customFieldData.push({
        field: {
          id: PLANFIX_FIELD_IDS.manager,
        },
        value: {
          id: managerId,
        },
      });
    }
    if (agencyId) {
      postBody.customFieldData.push({
        field: {
          id: PLANFIX_FIELD_IDS.agency,
        },
        value: {
          id: agencyId,
        },
      });
    }
    const response = await fetch(`${PLANFIX_BASE_URL}task/`, {
      method: 'POST',
      headers: PLANFIX_HEADERS as any,
      body: JSON.stringify(postBody),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, ${errorText}`);
    }
    const result = await response.json();
    // console.log(`Task created with ID: ${result.id}`);
    const taskId = (result as any).id;
    const url = taskId ? `https://${PLANFIX_ACCOUNT}.planfix.com/task/${taskId}` : undefined;
    return { taskId, url };
  } catch (error: any) {
    return { taskId: 0, url: undefined, error: `Error creating task: ${error.message}` };
  }
}


async function createComment({ taskId, description, recipients }: { taskId: number; description: string; recipients?: number[] }): Promise<{ commentId: number | null; error?: string }> {
  // console.log(`Creating comment for task ${taskId}`);
  try {
    const postBody: any = {
      description: description.replace(/\n/g, '<br>'),
      recipients,
    };
    const response = await fetch(`${PLANFIX_BASE_URL}/task/${taskId}/comments/`, {
      method: 'POST',
      headers: PLANFIX_HEADERS as any,
      body: JSON.stringify(postBody),
    });
    if (!response.ok) {
      const errorText = await response.text();
      return { commentId: 0, error: `HTTP error! Status: ${response.status}, ${errorText}` };
    }
    const result = await response.json();
    // console.log(`Comment created with ID: ${result.id}`);
    return { commentId: (result as any).id };
  } catch (error: any) {
    return { commentId: 0, error: `Error creating comment: ${error.message}` };
  }
}

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

const SEARCH_LEAD_TASK_TOOL: Tool = {
  name: "planfix_search_lead_task",
  description: "Search Planfix task by name and clientId.",
  inputSchema: zodToJsonSchema(SearchLeadTaskInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(SearchLeadTaskOutputSchema) as CallToolResult,
  func: searchLeadTask,
};

const LEAD_TO_TASK_TOOL: Tool = {
  name: "planfix_add_to_lead_task",
  description: "Create or update Planfix contact, task, and comment for a lead. Hides internal complexity.",
  inputSchema: zodToJsonSchema(LeadToTaskInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(LeadToTaskOutputSchema) as CallToolResult,
  func: leadToTask,
};

const SEARCH_PLANFIX_CONTACT_TOOL: Tool = {
  name: "planfix_search_contact",
  description: "Search Planfix contact by name, phone, email, or telegram.",
  inputSchema: zodToJsonSchema(SearchPlanfixContactInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(SearchPlanfixContactOutputSchema) as CallToolResult,
  func: searchPlanfixContact,
};


const SEARCH_PLANFIX_COMPANY_TOOL: Tool = {
  name: 'planfix_search_company',
  description: 'Search for a company in Planfix by name',
  inputSchema: zodToJsonSchema(SearchPlanfixCompanyInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(SearchPlanfixCompanyOutputSchema) as CallToolResult,
  func: searchPlanfixCompany,
};

const CREATE_PLANFIX_CONTACT_TOOL: Tool = {
  name: "planfix_create_contact",
  description: "Create a new contact in Planfix.",
  inputSchema: zodToJsonSchema(CreatePlanfixContactInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(CreatePlanfixContactOutputSchema) as CallToolResult,
  func: createPlanfixContact,
};

const SEARCH_MANAGER_TOOL: Tool = {
  name: "planfix_search_manager",
  description: "Search a manager in Planfix by email.",
  inputSchema: zodToJsonSchema(SearchManagerInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(SearchManagerOutputSchema) as CallToolResult,
  func: searchManager,
};

const SEARCH_PLANFIX_TASK_TOOL: Tool = {
  name: "planfix_search_task",
  description: "Search Planfix task by name and clientId.",
  inputSchema: zodToJsonSchema(SearchPlanfixTaskInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(SearchPlanfixTaskOutputSchema) as CallToolResult,
  func: searchPlanfixTask,
};

const CREATE_LEAD_TASK_TOOL: Tool = {
  name: "planfix_create_lead_task",
  description: "Create a new lead task in Planfix.",
  inputSchema: zodToJsonSchema(CreateLeadTaskInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(CreateLeadTaskOutputSchema) as CallToolResult,
  func: createLeadTask,
};

const CREATE_COMMENT_TOOL: Tool = {
  name: "planfix_create_comment",
  description: "Create a comment for a task in Planfix.",
  inputSchema: zodToJsonSchema(CreateCommentInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(CreateCommentOutputSchema) as CallToolResult,
  func: createComment,
};

const CREATE_SELL_TASK_TOOL: Tool = {
  name: "planfix_create_sell_task",
  description: "Create a sell task in Planfix using the SELL template. Requires clientId and leadTaskId.",
  inputSchema: zodToJsonSchema(CreateSellTaskInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(CreateSellTaskOutputSchema) as CallToolResult,
  func: planfixCreateSellTask,
};

const LIST_REPORTS_TOOL: Tool = {
  name: "planfix_reports_list",
  description: "List all available reports in Planfix with their IDs and names",
  inputSchema: zodToJsonSchema(ListReportsInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(ListReportsOutputSchema) as CallToolResult,
  func: listReports
};

const RUN_REPORT_TOOL: Tool = {
  name: "planfix_run_report",
  description: "Run a Planfix report by ID and return the report data.",
  inputSchema: zodToJsonSchema(RunReportInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(RunReportOutputSchema) as CallToolResult,
  func: runReport,
};

const GET_CHILD_TASKS_TOOL: Tool = {
  name: "planfix_get_child_tasks",
  description: "Get all child tasks of a specific parent task in Planfix.",
  inputSchema: zodToJsonSchema(GetChildTasksInputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(GetChildTasksOutputSchema) as CallToolResult,
  func: getChildTasks,
};


/**
 * Retrieves all child tasks of a specific parent task
 */
async function getChildTasks({ parentTaskId }: z.infer<typeof GetChildTasksInputSchema>): Promise<z.infer<typeof GetChildTasksOutputSchema>> {
  try {
    const response = await fetch(`${PLANFIX_BASE_URL}task/list`, {
      method: 'POST',
      headers: PLANFIX_HEADERS,
      body: JSON.stringify({
        parent: { id: parentTaskId },
        pageSize: 100,
        offset: 0,
        fields: [
          'id',
          'name',
          'description',
          'assignees',
          'status',
        ].join(','),
        filters: [
          {
            type: 73,
            operator: "eq",
            value: parentTaskId
          }
        ],
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error getting child tasks:', error);
      return {
        tasks: [],
        totalCount: 0,
        error: `Error ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json() as {
      tasks?: Array<{
        id: number;
        name: string;
        description?: string;
        status: {
          id: number;
          name: string;
          isActive: boolean;
        };
        assignees: {
          id: number;
          name: string;
          isActive: boolean;
        }[];
      }>;
      pagination?: {
        count: number;
        pageNumber: number;
        pageSize: number;
      };
    };
    
    const tasks = data.tasks?.map(task => ({
      id: task.id,
      name: task.name,
      url: `https://${PLANFIX_ACCOUNT}.planfix.com/task/${task.id}`,
      description: task.description,
      assignees: task.assignees,
      status: task.status.name,
    })) || [];
    return {
      tasks,
      totalCount: data.pagination?.count || 0,
    };
  } catch (error) {
    console.error('Exception when getting child tasks:', error);
    return {
      tasks: [],
      totalCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

const TOOLS: Tool[] = [
  SEARCH_LEAD_TASK_TOOL,
  LEAD_TO_TASK_TOOL,
  SEARCH_PLANFIX_CONTACT_TOOL,
  SEARCH_PLANFIX_COMPANY_TOOL,
  CREATE_PLANFIX_CONTACT_TOOL,
  SEARCH_MANAGER_TOOL,
  SEARCH_PLANFIX_TASK_TOOL,
  CREATE_LEAD_TASK_TOOL,
  CREATE_COMMENT_TOOL,
  CREATE_SELL_TASK_TOOL,
  GET_CHILD_TASKS_TOOL,
  RUN_REPORT_TOOL,
  LIST_REPORTS_TOOL,
];

// --- MCP Server Setup ---
const server = new Server(
  {
    name: "planfix-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

function getAnswerJson(data: any): { content: { type: string; text: string }[]; structuredContent: any } {
  return { structuredContent: data, content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log(`Received tool call: ${name}`);
  try {
    if (name === SEARCH_LEAD_TASK_TOOL.name) {
      const userData = SearchLeadTaskInputSchema.parse(args);
      return getAnswerJson(await searchLeadTask(userData));
    }
    if (name === LEAD_TO_TASK_TOOL.name) {
      const { name, phone, email, telegram, header, message } = LeadToTaskInputSchema.parse(args);
      return getAnswerJson(await leadToTask({ name, phone, email, telegram, header, message }));
    }
    if (name === SEARCH_PLANFIX_CONTACT_TOOL.name) {
      const { name, phone, email, telegram } = SearchPlanfixContactInputSchema.parse(args);
      return getAnswerJson(await searchPlanfixContact({ name, phone, email, telegram }));
    }
    if (name === CREATE_PLANFIX_CONTACT_TOOL.name) {
      const { name, phone, email, telegram } = CreatePlanfixContactInputSchema.parse(args);
      return getAnswerJson(await createPlanfixContact({ name, phone, email, telegram }));
    }
    if (name === SEARCH_PLANFIX_COMPANY_TOOL.name) {
      const { name } = SearchPlanfixCompanyInputSchema.parse(args);
      return getAnswerJson(await searchPlanfixCompany({ name }));
    }
    if (name === SEARCH_MANAGER_TOOL.name) {
      const { email } = SearchManagerInputSchema.parse(args);
      const result = await searchManager({ email });
      return getAnswerJson(result);
    }
    if (name === SEARCH_PLANFIX_TASK_TOOL.name) {
      const { taskName, clientId } = SearchPlanfixTaskInputSchema.parse(args);
      return getAnswerJson(await searchPlanfixTask({ taskName, clientId }));
    }
    if (name === CREATE_LEAD_TASK_TOOL.name) {
      const { name, description, clientId } = CreateLeadTaskInputSchema.parse(args);
      return getAnswerJson(await createLeadTask({ name, description, clientId }));
    }
    if (name === CREATE_COMMENT_TOOL.name) {
      const { taskId, description, recipients } = CreateCommentInputSchema.parse(args);
      return getAnswerJson(await createComment({ taskId, description, recipients }));
    }
    if (name === CREATE_SELL_TASK_TOOL.name) {
      const { clientId, leadTaskId, agencyId, assignees, name, description } = CreateSellTaskInputSchema.parse(args);
      return getAnswerJson(await planfixCreateSellTask({ clientId, leadTaskId, agencyId, assignees, name, description }));
    }
    if (name === GET_CHILD_TASKS_TOOL.name) {
      const { parentTaskId } = GetChildTasksInputSchema.parse(args);
      return getAnswerJson(await getChildTasks({ parentTaskId }));
    }
    if (name === LIST_REPORTS_TOOL.name) {
      return getAnswerJson(await listReports());
    }
    if (name === RUN_REPORT_TOOL.name) {
      const { reportId } = RunReportInputSchema.parse(args);
      return getAnswerJson(await runReport({ reportId }));
    }
    console.log(`Unknown tool name: ${name}`);
    process.exit(1);
    // throw new Error(`Unknown tool name: ${name}`);
  } catch (error) {
    return {
      content: [
        { type: "text", text: `Error: ${(error as Error).message}` },
      ],
      isError: true,
    };
  }
});

// --- Startup & Cleanup ---
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on("SIGINT", async () => {
    console.log("SIGINT received, shutting down Planfix server...");
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
