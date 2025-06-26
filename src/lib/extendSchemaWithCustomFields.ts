import { z } from "zod";

export interface CustomField {
  id: number;
  name?: string;
  argName: string;
  type?: string;
  values?: string[];
}

export function extendSchemaWithCustomFields<
  T extends z.ZodRawShape,
  U extends Record<string, z.ZodTypeAny> = Record<string, z.ZodTypeAny>
>(
  schema: z.ZodObject<T>,
  fields: CustomField[],
): z.ZodObject<T & U> {
  const additions = {} as U;
  
  for (const f of fields) {
    if (!f.argName) continue;
    
    let fieldSchema: z.ZodTypeAny;
    if (f.type === "number") {
      fieldSchema = z.number().optional();
    } else if (f.type === "enum" && Array.isArray(f.values) && f.values.length) {
      fieldSchema = z.enum([...f.values] as [string, ...string[]]).optional();
    } else {
      fieldSchema = z.string().optional();
    }
    
    additions[f.argName as keyof U] = fieldSchema as U[keyof U];
  }
  
  return schema.extend(additions) as unknown as z.ZodObject<T & U>;
}
