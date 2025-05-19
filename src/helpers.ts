import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PLANFIX_ACCOUNT, PLANFIX_BASE_URL, PLANFIX_HEADERS } from './config.js';
import { ToolWithHandler } from './types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ToolInput, ToolOutput } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(message: string) {
  // write to data/mcp.log, format [date time] message
  const logPath = path.join(__dirname, '..', 'data', 'mcp.log');
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logPath, logMessage);
}

export function getToolWithHandler({
  name,
  description,
  inputSchema,
  outputSchema,
  handler,
}: {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema: any;
  handler: any;
}): ToolWithHandler {
  return {
    name,
    description,
    inputSchema: zodToJsonSchema(inputSchema) as ToolInput,
    outputSchema: zodToJsonSchema(outputSchema) as ToolOutput,
    handler,
  };
}

export async function planfixRequest(url: string, body?: any, method?: 'GET' | 'POST') {
  const response = await fetch(`${PLANFIX_BASE_URL}${url}`, {
    method: method || 'POST',
    headers: PLANFIX_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });

  const result = await response.json();

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! Status: ${response.status}, ${errorText}`);
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