import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import fsp from "fs/promises";
import {
  PLANFIX_ACCOUNT,
  PLANFIX_BASE_URL,
  PLANFIX_HEADERS,
} from "./config.js";
import { ContactRequestBody, TaskRequestBody, ToolInput, ToolWithHandler } from "./types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { execa } from "execa";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { getCacheProvider } from "./lib/cache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(message: string) {
  // write to data/mcp.log, format [date time] message
  const logPath = path.join(__dirname, "..", "data", "mcp.log");
  if (!fs.existsSync(logPath)) {
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  }
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logPath, logMessage);
}

export function debugLog(message: string) {
  if (process.env.LOG_LEVEL === "debug") {
    log(`[debug] ${message}`);
  }
}

export function getToolWithHandler<
  Input extends z.ZodType,
  Output extends z.ZodType,
>({
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
    // `outputSchema` should be JSON schema object similar to inputSchema
    outputSchema: zodToJsonSchema(outputSchema) as ToolInput,
    handler,
  };
}

export interface PlanfixRequestArgs {
  path: string;
  body?: Record<string, unknown> | ContactRequestBody | TaskRequestBody;
  method?: "GET" | "POST";
  cacheTime?: number;
}

export async function planfixRequest<T = unknown>({
  path,
  body,
  method = "POST",
  cacheTime = 0,
}: PlanfixRequestArgs): Promise<T> {
  if (!PLANFIX_ACCOUNT) {
    throw new Error("PLANFIX_ACCOUNT is not defined");
  }

  const cache = getCacheProvider();
  const cacheKey = JSON.stringify({ path, body, method });
  if (cacheTime > 0) {
    const cached = await cache.get<T>(cacheKey);
    if (cached !== undefined) {
      log(`[planfixRequest] Cache hit for ${path}`);
      return cached;
    }
  }

  let requestUrl = path;
  let requestBody: string | undefined;

  if (method === "GET" && body) {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    const queryString = params.toString();
    requestUrl = queryString
      ? `${path}${path.includes("?") ? "&" : "?"}${queryString}`
      : path;
  } else if (body) {
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(`${PLANFIX_BASE_URL}${requestUrl}`, {
    method,
    headers: PLANFIX_HEADERS,
    body: requestBody,
  });

  const result = await response.json();

  log(
    `[planfixRequest] ${response.status} ${method} ${PLANFIX_BASE_URL}${requestUrl}, body: ${requestBody}`,
  );

  if (!response.ok) {
    log(
      `[planfixRequest] HTTP error! Status: ${response.status}, ${result.error}`,
    );
    log(`[planfixRequest] Body: ${requestBody}`);
    throw new Error(result.error || `Unknown error: ${response.status}`);
  }

  if (cacheTime > 0) {
    await cache.set(cacheKey, result, cacheTime);
  }

  return result;
}

export function getTaskUrl(taskId?: number): string {
  return taskId ? `https://${PLANFIX_ACCOUNT}.planfix.com/task/${taskId}` : "";
}

export function getCommentUrl(taskId?: number, commentId?: number): string {
  return taskId && commentId
    ? `https://${PLANFIX_ACCOUNT}.planfix.com/task/${taskId}?comment=${commentId}`
    : "";
}

export function getContactUrl(contactId?: number): string {
  return contactId
    ? `https://${PLANFIX_ACCOUNT}.planfix.com/contact/${contactId}`
    : "";
}

export function getUserUrl(userId?: number): string {
  return userId ? `https://${PLANFIX_ACCOUNT}.planfix.com/user/${userId}` : "";
}

export async function runCli(args: string[]) {
  try {
    const cliArgs = ["-s", "run", "mcp-cli", "--"];
    const { stdout } = await execa("npm", [...cliArgs, ...args], {
      stdin: "inherit",
    });
    return JSON.parse(stdout);
  } catch (error: unknown) {
    const errorObj = error as { stdout: string; stderr: string };
    if (errorObj.stdout) console.error("CLI STDOUT:", errorObj.stdout);
    if (errorObj.stderr) console.error("CLI STDERR:", errorObj.stderr);
    throw error;
  }
}

let clientTest: Client;
export async function runCliTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResponse> {
  if (!clientTest) {
    clientTest = new Client({ name: "test", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: "npm",
      args: ["run", "dev"],
      env: {
        ...process.env,
        NODE_OPTIONS:
          `--unhandled-rejections=warn ${process.env.NODE_OPTIONS || ""}`.trim(),
      },
    });
    await clientTest.connect(transport);
  }
  const result = await clientTest.callTool({ name: toolName, arguments: args });
  return result as ToolResponse;
}

interface ToolResponse {
  content: Array<{ text: string }>;
  structuredContent?: unknown;
}

export async function runTool<T = unknown>(
  toolName: string,
  params: Record<string, unknown>,
): Promise<{ parsed: ToolResponse; valid: boolean; content: T }> {
  // return runToolInspector(toolName, params);
  const parsed = await runCliTool(toolName, params);
  const valid = isValidToolResponse(parsed);
  const content = JSON.parse(parsed.content[0].text);

  return { parsed, valid, content };
}

export async function runToolInspector<T = unknown>(
  toolName: string,
  params: Record<string, unknown>,
): Promise<{ parsed: ToolResponse; valid: boolean; content: T }> {
  const args = [
    "--method",
    "tools/call",
    "--tool-name",
    toolName,
    ...Object.entries(params).flatMap(([key, value]) => {
      const val = typeof value === "string" ? value : JSON.stringify(value);
      return ["--tool-arg", `${key}=${val}`];
    }),
  ];
  const parsed = await runCli(args);
  const valid = isValidToolResponse(parsed);
  const content = JSON.parse(parsed.content[0].text);

  return { parsed, valid, content };
}

export function isValidToolResponse(parsed: unknown): parsed is ToolResponse {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    "content" in parsed &&
    Array.isArray(parsed.content) &&
    parsed.content.length > 0 &&
    "structuredContent" in parsed
  );
}

export interface CacheData<T = unknown> {
  data: T;
  expiresAt: number;
}

export async function withCache<T>(
  name: string,
  dataFn: () => Promise<T>,
  maxAge: number = 600,
): Promise<T> {
  const cacheDir = path.join(__dirname, "..", "data", "cache");
  const cachePath = path.join(cacheDir, `${name}.json`);
  debugLog(`[withCache] cache path: ${cachePath}`);

  try {
    // Ensure cache directory exists with recursive: true
    try {
      await fsp.mkdir(cacheDir, { recursive: true });
      debugLog(`[withCache] cache dir ensured: ${cacheDir}`);
    } catch (error) {
      log(
        `Failed to create cache directory: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    // Try to read from cache
    try {
      const fileContent = await fsp.readFile(cachePath, "utf-8");
      const cacheData: CacheData<T> = JSON.parse(fileContent);

      // Check if cache is still valid
      if (cacheData.expiresAt > Date.now()) {
        debugLog(`[withCache] cache hit: ${name}`);
        return cacheData.data;
      }
      debugLog(`[withCache] cache expired: ${name}`);
    } catch (error: unknown) {
      // Cache file doesn't exist or is invalid, continue to generate new data
      debugLog(
        `[withCache] cache miss for ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      log(
        `Cache miss for ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Generate and cache new data
    const data = await dataFn();
    const cacheData: CacheData<T> = {
      data,
      expiresAt: Date.now() + maxAge * 1000,
    };

    await fsp.writeFile(cachePath, JSON.stringify(cacheData, null, 2), "utf-8");
    debugLog(`[withCache] wrote cache: ${name}`);
    return data;
  } catch (error) {
    log(
      `[withCache] Error with cache for ${name}: ${error instanceof Error ? error.message : String(error)}`,
    );
    // If there's any error with caching, just generate fresh data
    return dataFn();
  }
}
