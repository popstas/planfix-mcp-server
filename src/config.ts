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
// REST API base URL. Defaults to the .com TLD; override via PLANFIX_BASE_URL
// for .ru and other regional Planfix installations
// (e.g. "https://youraccount.planfix.ru/rest/").
export const PLANFIX_BASE_URL =
  process.env.PLANFIX_BASE_URL ||
  `https://${PLANFIX_ACCOUNT}.planfix.com/rest/`;
// Web origin for human-facing links (task/contact/user pages). Derived from
// PLANFIX_BASE_URL by stripping the trailing "/rest/" so a single override
// keeps API calls and generated links on the same host. Can be set explicitly
// via PLANFIX_ACCOUNT_URL.
export const PLANFIX_ACCOUNT_URL =
  process.env.PLANFIX_ACCOUNT_URL || PLANFIX_BASE_URL.replace(/\/rest\/?$/, "");
export const PLANFIX_HEADERS = {
  Authorization: `Bearer ${PLANFIX_TOKEN}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

export const PLANFIX_DRY_RUN = Boolean(process.env.PLANFIX_DRY_RUN);

export const PLANFIX_TASK_TITLE_TEMPLATE =
  process.env.PLANFIX_TASK_TITLE_TEMPLATE || "";

export const PLANFIX_FIELD_IDS = {
  email: Number(process.env.PLANFIX_FIELD_ID_EMAIL || 108),
  // No default: 124 is the read-only system field, not a writable custom field.
  // 0 disables the additional-emails write and 4101 search tiers.
  emailAdditional: Number(process.env.PLANFIX_FIELD_ID_EMAIL_ADDITIONAL || 0),
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
