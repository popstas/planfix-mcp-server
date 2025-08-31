import { log } from "console";
import { PLANFIX_ACCOUNT } from "./config.js";
import { chatApiConfig } from "./customFieldsConfig.js";

export interface ChatApiRequestBody<TParams = Record<string, unknown>> {
  cmd: string;
  params?: TParams;
}

export interface ChatApiChatResponse {
  chatId: number;
  contactId: number;
}

export interface ChatApiNumberResponse {
  data: string;
  number: number;
  statusIsActive: boolean;
}

// Build a stable chat identifier based on available contact info
// Priority: `chat${clientId}` | phone | email | telegram | Date.now()
export function getChatId(args: {
  clientId?: number;
  phone?: string;
  email?: string;
  telegram?: string;
}): string {
  const { clientId, phone, email, telegram } = args ?? {};
  const id =
    (typeof clientId === "number" ? `chat${clientId}` : undefined) ||
    phone ||
    email ||
    telegram ||
    String(Date.now());
  return String(id);
}

export async function chatApiRequest<
  TResponse = unknown,
  TParams = Record<string, unknown>,
>(cmd: string, params?: TParams): Promise<TResponse> {
  if (!PLANFIX_ACCOUNT) {
    throw new Error("PLANFIX_ACCOUNT is not defined");
  }

  const baseUrl =
    chatApiConfig.baseUrl ||
    `https://${PLANFIX_ACCOUNT}.planfix.com/webchat/api`;
  const url = new URL(baseUrl);

  // Build x-www-form-urlencoded body as required by Planfix Chat API
  const usp = new URLSearchParams();
  usp.set("cmd", cmd);
  usp.set("providerId", chatApiConfig.providerId);
  usp.set("planfix_token", chatApiConfig.chatApiToken);
  // chatId is commonly used by Chat API, but may be absent for some commands
  const maybeChatId = (params as Record<string, unknown> | undefined)?.["chatId"];
  if (maybeChatId !== undefined && maybeChatId !== null) {
    usp.set("chatId", String(maybeChatId));
  }

  const appendValue = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (value instanceof Date) {
      usp.append(key, value.toISOString());
      return;
    }
    const t = typeof value;
    if (t === "string" || t === "number" || t === "boolean") {
      usp.append(key, String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object") {
          for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
            appendValue(`${key}[${k}]`, v);
          }
        } else {
          appendValue(`${key}[]`, item);
        }
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        appendValue(`${key}[${k}]`, v);
      }
    }
  };

  if (params && typeof params === "object") {
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      appendValue(k, v);
    }
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: usp.toString(),
  });

  if (!response.ok) {
    log(getCurlRequest(url, { method: "POST", body: usp.toString() }));
    throw new Error(`Chat API request failed with status ${response.status}`);
  }

  try {
    const data = await response.json() as { data: string };
    const json = JSON.parse(data.data);
    return json as TResponse;
  } catch (error) {
    log(`Expected: error, got: ${String(error)}`);
    return {} as TResponse;
  }
}


// Build a curl command that replicates a given HTTP request.
// Useful for debugging and reproducing Planfix Chat API calls.
export function getCurlRequest(
  url: string | URL,
  options: {
    method?: string;
    headers?: Record<string, string | number | boolean | undefined>;
    body?: string;
  } = {},
): string {
  const method = options.method ?? "POST";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    ...Object.fromEntries(
      Object.entries(options.headers ?? {}).flatMap(([k, v]) =>
        v === undefined ? [] : [[k, String(v)]] as [string, string][]
      ),
    ),
  };

  const quote = (s: string) => `'${s.replace(/'/g, `'"'"'`)}'`;
  const parts: string[] = ["curl", "-sS", "-X", method, quote(String(url))];

  for (const [k, v] of Object.entries(headers)) {
    parts.push("-H", quote(`${k}: ${v}`));
  }

  if (options.body !== undefined) {
    parts.push("--data", quote(options.body));
  }

  return parts.join(" ");
}

