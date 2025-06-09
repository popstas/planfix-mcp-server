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

export const PLANFIX_FIELD_ID_TELEGRAM = Number(
  process.env.PLANFIX_FIELD_ID_TELEGRAM,
);
export const PLANFIX_FIELD_ID_TELEGRAM_CUSTOM = Number(
  process.env.PLANFIX_FIELD_ID_TELEGRAM_CUSTOM,
);

export const PLANFIX_FIELD_IDS = {
  email: Number(process.env.PLANFIX_FIELD_ID_EMAIL),
  phone: Number(process.env.PLANFIX_FIELD_ID_PHONE),
  telegramCustom: PLANFIX_FIELD_ID_TELEGRAM_CUSTOM,
  client: Number(process.env.PLANFIX_FIELD_ID_CLIENT),
  manager: Number(process.env.PLANFIX_FIELD_ID_MANAGER),
  agency: Number(process.env.PLANFIX_FIELD_ID_AGENCY),
  saleSource: Number(process.env.PLANFIX_FIELD_ID_SALE_SOURCE),
  serviceMatrix: Number(process.env.PLANFIX_FIELD_ID_SERVICE_MATRIX),
};
