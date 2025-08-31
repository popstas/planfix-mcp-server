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

    // Verify fetch was called with correct URL and form-encoded body
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = (fetchMock as any).mock.calls[0];
    expect(calledUrl).toBe("https://acc.planfix.com/webchat/api");
    expect(options).toMatchObject({ method: "POST" });
    expect(options.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    });

    const usp = new URLSearchParams(options.body as string);
    expect(usp.get("cmd")).toBe("init");
    expect(usp.get("providerId")).toBe("pid");
    expect(usp.get("planfix_token")).toBe("tkn");
    expect(usp.get("a")).toBe("1");

    expect(res).toEqual({ chatId: 1, contactId: 2 });
  });
});
