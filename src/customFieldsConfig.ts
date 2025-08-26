import fs from "fs";
import yaml from "js-yaml";
import { CustomField } from "./lib/extendSchemaWithCustomFields.js";

export interface ChatApiConfig {
  chatApiToken: string;
  providerId: string;
  useChatApi: boolean;
  baseUrl: string;
}

export interface AppConfig {
  leadTaskFields: CustomField[];
  contactFields: CustomField[];
  chatApi: ChatApiConfig;
}

const DEFAULT_PATH = "./data/config.yml";

export function getConfigPath(): string {
  const cli = process.argv.find((a) => a.startsWith("--config="));
  if (cli) return cli.slice("--config=".length);
  if (process.env.PLANFIX_CONFIG) return process.env.PLANFIX_CONFIG;
  return DEFAULT_PATH;
}

function parseEnv(name: string): CustomField[] {
  const raw = process.env[name];
  if (!raw) return [];
  try {
    const data = yaml.load(raw);
    return Array.isArray(data) ? (data as CustomField[]) : [];
  } catch {
    return [];
  }
}

function mergeFields(
  envFields: CustomField[],
  fileFields: CustomField[],
): CustomField[] {
  const map = new Map<number, CustomField>();
  for (const f of envFields) {
    if (f && f.id !== undefined)
      map.set(Number(f.id), { ...f, id: Number(f.id) });
  }
  for (const f of fileFields) {
    if (f && f.id !== undefined) {
      const id = Number(f.id);
      map.set(id, { ...map.get(id), ...f, id });
    }
  }
  return Array.from(map.values());
}

export function loadCustomFieldsConfig(): AppConfig {
  const envLead = parseEnv("PLANFIX_LEAD_TASK_FIELDS");
  const envContact = parseEnv("PLANFIX_CONTACT_FIELDS");
  let fileLead: CustomField[] = [];
  let fileContact: CustomField[] = [];
  let fileChatApi: Partial<ChatApiConfig> = {};

  const path = getConfigPath();
  if (fs.existsSync(path)) {
    try {
      const content = fs.readFileSync(path, "utf8");
      const parsed = yaml.load(content) as Partial<AppConfig> | undefined;
      fileLead = Array.isArray(parsed?.leadTaskFields)
        ? (parsed!.leadTaskFields as CustomField[])
        : [];
      fileContact = Array.isArray(parsed?.contactFields)
        ? (parsed!.contactFields as CustomField[])
        : [];
      if (parsed?.chatApi && typeof parsed.chatApi === "object") {
        fileChatApi = parsed.chatApi as ChatApiConfig;
      }
    } catch {
      // ignore
    }
  }

  const chatApi: ChatApiConfig = {
    chatApiToken: "",
    providerId: "",
    useChatApi: false,
    baseUrl: "",
    ...fileChatApi,
  };

  return {
    leadTaskFields: mergeFields(envLead, fileLead),
    contactFields: mergeFields(envContact, fileContact),
    chatApi,
  };
}

const cfg = loadCustomFieldsConfig();
export const customFieldsConfig = {
  leadTaskFields: cfg.leadTaskFields,
  contactFields: cfg.contactFields,
};
export const chatApiConfig = cfg.chatApi;
