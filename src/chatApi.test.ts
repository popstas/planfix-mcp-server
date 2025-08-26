import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("./customFieldsConfig.js", () => ({
  chatApiConfig: {
    chatApiToken: "tkn",
    providerId: "pid",
    useChatApi: true,
    baseUrl: "",
  },
}));

const createFetchMock = (body: any) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => body });

describe("chatApiRequest", () => {
  beforeEach(() => {
    process.env.PLANFIX_ACCOUNT = "acc";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("sends request with cmd and tokens", async () => {
    const fetchMock = createFetchMock({ chatId: 1, contactId: 2 });
    vi.stubGlobal("fetch", fetchMock);

    const { chatApiRequest } = await import("./chatApi.js");
    const res = await chatApiRequest("init", { a: 1 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://acc.planfix.com/webchat/api?planfix_token=tkn&providerId=pid",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cmd: "init", params: { a: 1 } }),
      },
    );
    expect(res).toEqual({ chatId: 1, contactId: 2 });
  });
});
