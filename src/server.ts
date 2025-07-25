import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { log } from "./helpers.js";
import { ToolWithHandler } from "./types.js";

import planfix_add_to_lead_task from "./tools/planfix_add_to_lead_task.js";
import planfix_create_comment from "./tools/planfix_create_comment.js";
import planfix_create_contact from "./tools/planfix_create_contact.js";
import planfix_create_lead_task from "./tools/planfix_create_lead_task.js";
import planfix_create_sell_task from "./tools/planfix_create_sell_task.js";
import planfix_create_task from "./tools/planfix_create_task.js";
import planfix_get_child_tasks from "./tools/planfix_get_child_tasks.js";
import planfix_get_report_fields from "./tools/planfix_get_report_fields.js";
import planfix_reports_list from "./tools/planfix_reports_list.js";
import planfix_request from "./tools/planfix_request.js";
import planfix_run_report from "./tools/planfix_run_report.js";
import planfix_search_company from "./tools/planfix_search_company.js";
import planfix_search_contact from "./tools/planfix_search_contact.js";
import planfix_search_directory from "./tools/planfix_search_directory.js";
import planfix_search_directory_entry from "./tools/planfix_search_directory_entry.js";
import planfix_search_lead_task from "./tools/planfix_search_lead_task.js";
import planfix_search_manager from "./tools/planfix_search_manager.js";
import planfix_search_project from "./tools/planfix_search_project.js";
import planfix_search_task from "./tools/planfix_search_task.js";
import planfix_update_contact from "./tools/planfix_update_contact.js";
import planfix_update_lead_task from "./tools/planfix_update_lead_task.js";

export const TOOLS: ToolWithHandler[] = [
  planfix_add_to_lead_task,
  planfix_create_comment,
  planfix_create_contact,
  planfix_create_lead_task,
  planfix_create_sell_task,
  planfix_create_task,
  planfix_get_child_tasks,
  planfix_get_report_fields,
  planfix_reports_list,
  planfix_request,
  planfix_run_report,
  planfix_search_company,
  planfix_search_contact,
  planfix_search_directory,
  planfix_search_directory_entry,
  planfix_search_lead_task,
  planfix_search_manager,
  planfix_search_project,
  planfix_search_task,
  planfix_update_contact,
  planfix_update_lead_task,
];

export function createPlanfixServer(): Server {
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

  interface AnswerContent {
    type: string;
    text: string;
  }

  interface AnswerJson<T = unknown> {
    content: AnswerContent[];
    structuredContent: T;
  }

  function getAnswerJson<T = unknown>(data: T): AnswerJson<T> {
    return {
      structuredContent: data,
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }

  // @ts-expect-error - The SDK's type definitions are too strict for our use case
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    log(`Received tool call: ${name}`);
    try {
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool?.handler) {
        return getAnswerJson({ error: `Handler not found for tool: ${name}` });
      }
      return getAnswerJson(await tool.handler(args));
    } catch (error) {
      console.error(`Error calling tool ${name}:`, error);
      return getAnswerJson({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return server;
}
