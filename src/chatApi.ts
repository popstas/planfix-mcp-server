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
  data: { number: number };
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
  url.searchParams.set("planfix_token", chatApiConfig.chatApiToken);
  url.searchParams.set("providerId", chatApiConfig.providerId);

  const body: ChatApiRequestBody<TParams> = { cmd };
  if (params) {
    body.params = params;
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Chat API request failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
