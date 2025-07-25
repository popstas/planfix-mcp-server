import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

// change cwd to current file directory before load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(path.join(__dirname, ".."));
dotenv.config();

// Planfix API configuration
export const PLANFIX_ACCOUNT = process.env.PLANFIX_ACCOUNT || "";
export const PLANFIX_TOKEN = process.env.PLANFIX_TOKEN || "";
export const PLANFIX_BASE_URL = `https://${PLANFIX_ACCOUNT}.planfix.com/rest/`;
export const PLANFIX_HEADERS = {
  Authorization: `Bearer ${PLANFIX_TOKEN}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

export const PLANFIX_DRY_RUN = Boolean(process.env.PLANFIX_DRY_RUN);

export const PLANFIX_TASK_TITLE_TEMPLATE = process.env.PLANFIX_TASK_TITLE_TEMPLATE || "";

export const PLANFIX_FIELD_IDS = {
  email: Number(process.env.PLANFIX_FIELD_ID_EMAIL || 108),
  phone: Number(process.env.PLANFIX_FIELD_ID_PHONE || 105),
  telegram: process.env.PLANFIX_FIELD_ID_TELEGRAM_CUSTOM
    ? 0
    : Number(process.env.PLANFIX_FIELD_ID_TELEGRAM || 131),
  telegramCustom: Number(process.env.PLANFIX_FIELD_ID_TELEGRAM_CUSTOM),
  client: Number(process.env.PLANFIX_FIELD_ID_CLIENT),
  manager: Number(process.env.PLANFIX_FIELD_ID_MANAGER),
  agency: Number(process.env.PLANFIX_FIELD_ID_AGENCY),
  leadSource: Number(process.env.PLANFIX_FIELD_ID_LEAD_SOURCE),
  pipeline: Number(process.env.PLANFIX_FIELD_ID_PIPELINE),
  serviceMatrix: Number(process.env.PLANFIX_FIELD_ID_SERVICE_MATRIX),
  tags: Number(process.env.PLANFIX_FIELD_ID_TAGS),
  leadId: Number(process.env.PLANFIX_FIELD_ID_LEAD_ID),
};
