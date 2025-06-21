import {
  CallToolResult,
  Tool,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export type ToolInput = z.infer<typeof ToolSchema.shape.inputSchema>;
export type ToolOutput = CallToolResult;

// Input and Output Schemas
export const UserDataInputSchema = z.object({
  name: z.string().optional(),
  nameTranslated: z
    .string()
    .optional()
    .describe("Translate name and place here"),
  phone: z.string().optional(),
  email: z.string().optional(),
  telegram: z.string().optional(),
  company: z.string().optional(),
});

export type UsersListType = {
  users: {
    id: string;
    name?: string;
  }[];
  groups?: {
    id: number;
  }[];
  roles?: string[];
};

export type CustomFieldDataType = {
  field: {
    id: number;
  };
  value: string | { id: number } | { id: number }[];
};

export type ToolWithHandler = Tool & {
  handler: <T = unknown>(args?: Record<string, unknown>) => Promise<T>;
};
