import { ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

const ToolInputSchema = ToolSchema.shape.inputSchema;
export type ToolInput = z.infer<typeof ToolInputSchema>;
export type ToolOutput = CallToolResult;

// Input and Output Schemas
export const UserDataInputSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  telegram: z.string().optional(),
  company: z.string().optional(),
});

export type CustomFieldDataType = {
  field: {
    id: number
  },
  value: string | { id: number }
}

export type ToolWithHandler = Tool & { handler: Function };
