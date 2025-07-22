import { z } from "zod";

export interface CustomField {
  id: number;
  name?: string;
  argName: string;
  type: "string" | "number" | "boolean" | "enum" | "handbook_record" | "handbook_record_multiple";
  values?: string[];
  default?: string;
}

export function extendSchemaWithCustomFields<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  fields: CustomField[],
): z.ZodObject<T> {
  const additions: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (!f.argName) continue;
    let fieldSchema: z.ZodTypeAny;
    if (f.type === "number") {
      fieldSchema = z.number().optional();
    } else if (
      f.type === "enum" &&
      Array.isArray(f.values) &&
      f.values.length
    ) {
      fieldSchema = z.enum([...f.values] as [string, ...string[]]).optional();
    } else {
      fieldSchema = z.string().optional();
    }
    additions[f.argName] = fieldSchema;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return schema.extend(additions) as any;
}
