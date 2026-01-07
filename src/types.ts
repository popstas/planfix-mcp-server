import {
  CallToolResult,
  Tool,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { customFieldsConfig } from "./customFieldsConfig.js";
import { extendSchemaWithCustomFields } from "./lib/extendSchemaWithCustomFields.js";

// Utility function to handle null values by converting them to undefined
const nullFix = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === null ? undefined : val), schema);

export type ToolInput = z.infer<typeof ToolSchema.shape.inputSchema>;
export type ToolOutput = CallToolResult;

// Input and Output Schemas
export const UserDataInputSchemaBase = z.object({
  name: z.string().optional(),
  nameTranslated: z
    .string()
    .optional()
    .describe("Translate name and place here"),
  phone: nullFix(z.string().optional()),
  email: nullFix(z.string().optional()),
  telegram: nullFix(z.string().optional()),
  instagram: nullFix(z.string().optional()),
  company: nullFix(z.string().optional()),
});

export const UserDataInputSchema = extendSchemaWithCustomFields(
  UserDataInputSchemaBase,
  customFieldsConfig.contactFields,
);

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
  value: string | string[] | number | { id: number } | { id: number }[];
};

export type ToolWithHandler = Tool & {
  handler: <T = unknown>(args?: Record<string, unknown>) => Promise<T>;
};

export interface TaskRequestBody {
  template: {
    id: number;
  };
  status?: {
    id: number;
  };
  name?: string;
  description?: string;
  customFieldData: CustomFieldDataType[];
  project?: {
    id: number;
  };
  assignees?: UsersListType;
}
export interface ContactRequestBody {
  template: {
    id: number;
  };
  name?: string;
  lastname?: string;
  email?: string;
  phones?: Array<{
    type: number;
    number: string;
  }>;
  telegram?: string;
  instagram?: string;
  customFieldData: CustomFieldDataType[];
}

export interface ContactResponse {
  id: number;
  name?: string;
  lastname?: string;
  email?: string;
  phones?: Array<{ number: string; type: number }>;
  telegram?: string;
  customFieldData?: CustomFieldDataType[];
}

export interface TaskResponse {
  id: number;
  project?: { id: number };
  assignees?: { users?: Array<{ id: string }> };
  customFieldData?: CustomFieldDataType[];
  status?: { id: number };
}
