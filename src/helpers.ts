import path from 'path';
import {fileURLToPath} from 'url';
import fs from 'fs';
import {PLANFIX_ACCOUNT, PLANFIX_BASE_URL, PLANFIX_HEADERS} from './config.js';
import {ToolInput, ToolOutput, ToolWithHandler} from './types.js';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {z} from 'zod';
import {execa} from 'execa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(message: string) {
  // write to data/mcp.log, format [date time] message
  const logPath = path.join(__dirname, '..', 'data', 'mcp.log');
  if (!fs.existsSync(logPath)) {
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  }
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logPath, logMessage);
}

export function getToolWithHandler<Input extends z.ZodType, Output extends z.ZodType>(
  {
    name,
    description,
    inputSchema,
    outputSchema,
    handler,
  }: {
    name: string;
    description: string;
    inputSchema: Input;
    outputSchema: Output;
    handler: (args: z.infer<Input>) => Promise<z.infer<Output>>;
  }): ToolWithHandler {
  return {
    name,
    description,
    inputSchema: zodToJsonSchema(inputSchema) as ToolInput,
    outputSchema: zodToJsonSchema(outputSchema) as ToolOutput,
    handler,
  };
}

export async function planfixRequest<T = unknown>(url: string, body?: Record<string, unknown>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  if (!PLANFIX_ACCOUNT) {
    throw new Error('PLANFIX_ACCOUNT is not defined');
  }
  
  let requestUrl = url;
  let requestBody: string | undefined;
  
  if (method === 'GET' && body) {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    const queryString = params.toString();
    requestUrl = queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url;
  } else if (body) {
    requestBody = JSON.stringify(body);
  }
  
  const response = await fetch(`${PLANFIX_BASE_URL}${requestUrl}`, {
    method,
    headers: PLANFIX_HEADERS,
    body: requestBody,
  });

  const result = await response.json();

  if (!response.ok) {
    log(`HTTP error! Status: ${response.status}, ${result.error}`);
    throw new Error(result.error || `Unknown error: ${response.status}`);
  }

  return result;
}

export function getTaskUrl(taskId?: number): string {
  return taskId ? `https://${PLANFIX_ACCOUNT}.planfix.com/task/${taskId}` : '';
}

export function getContactUrl(contactId?: number): string {
  return contactId ? `https://${PLANFIX_ACCOUNT}.planfix.com/contact/${contactId}` : '';
}

export function getUserUrl(userId?: number): string {
  return userId ? `https://${PLANFIX_ACCOUNT}.planfix.com/user/${userId}` : '';
}

export async function runCli(args: string[]) {
  try {
    const cliArgs = ['-s', 'run', 'mcp-cli', '--'];
    const { stdout } = await execa('npm', [...cliArgs, ...args], { stdin: 'inherit' });
    return JSON.parse(stdout);
  } catch (error: unknown) {
    const errorObj = error as { stdout: string; stderr: string };
    if (errorObj.stdout) console.error('CLI STDOUT:', errorObj.stdout);
    if (errorObj.stderr) console.error('CLI STDERR:', errorObj.stderr);
    throw error;
  }
}

interface ToolResponse {
  content: Array<{ text: string }>;
  structuredContent?: {
    content: unknown;
  };
}

export async function runTool<T = unknown>(
  toolName: string, 
  params: Record<string, unknown>
): Promise<{ parsed: ToolResponse; valid: boolean; content: T }> {
  const args = [
    '--method', 'tools/call',
    '--tool-name', toolName,
    ...Object.entries(params).flatMap(([key, value]) => {
      const val = typeof value === 'string' ? value : JSON.stringify(value);
      return ['--tool-arg', `${key}=${val}`]
    }),
  ];
  const parsed = await runCli(args);
  const valid = isValidToolResponse(parsed);
  const content = JSON.parse(parsed.content[0].text);

  return {parsed, valid, content};
}

export function isValidToolResponse(parsed: unknown): parsed is ToolResponse {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'content' in parsed &&
    Array.isArray(parsed.content) &&
    parsed.content.length > 0 &&
    'structuredContent' in parsed
  );
}