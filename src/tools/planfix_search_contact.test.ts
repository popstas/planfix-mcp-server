import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({
  PLANFIX_FIELD_IDS: {
    telegram: 131,
    telegramCustom: 0,
    emailAdditional: 124,
  },
}));

vi.mock("../customFieldsConfig.js", () => ({
  customFieldsConfig: { contactFields: [] },
  proxyUrl: "",
}));

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn(),
    getContactUrl: (id: number) => `https://example.com/contact/${id}`,
    log: vi.fn(),
  };
});

import { planfixRequest } from "../helpers.js";
import { planfixSearchContact } from "./planfix_search_contact.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);

describe("planfixSearchContact", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns contact when found by email", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      contacts: [{ id: 1, name: "John", lastname: "Doe" }],
    });

    const result = await planfixSearchContact({ email: "john@example.com" });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    const call = mockPlanfixRequest.mock.calls[0][0];
    expect(call.path).toBe("contact/list");
    const body = call.body as any;
    expect(body.filters[0]).toMatchObject({
      type: 4026,
      value: "john@example.com",
    });
    expect(result).toEqual({
      contactId: 1,
      url: "https://example.com/contact/1",
      firstName: "John",
      lastName: "Doe",
      found: true,
    });
  });

  it("skips phone search when phone is invalid", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      contacts: [{ id: 2, name: "Foo", lastname: "Bar" }],
    });

    const result = await planfixSearchContact({
      phone: "@foo",
      telegram: "foo",
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    const call = mockPlanfixRequest.mock.calls[0][0];
    // first call should be byTelegram filter
    const body = call.body as any;
    expect(body.filters[0]).toMatchObject({ value: "foo" });
    expect(result.contactId).toBe(2);
    expect(result.found).toBe(true);
  });

  it("handles API errors", async () => {
    mockPlanfixRequest.mockRejectedValueOnce(new Error("API fail"));

    const result = await planfixSearchContact({ email: "err@example.com" });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    expect(result.contactId).toBe(0);
    expect(result.error).toBeUndefined();
    expect(result.found).toBe(false);
  });

  it("matches primary email via main field without extra calls when no additionalEmails", async () => {
    // byEmail misses, no additionalEmails => behavior unchanged (single call)
    mockPlanfixRequest.mockResolvedValueOnce({ contacts: [] });

    const result = await planfixSearchContact({ email: "miss@example.com" });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    const call = mockPlanfixRequest.mock.calls[0][0];
    const body = call.body as any;
    expect(body.filters[0]).toMatchObject({ type: 4026 });
    expect(result.found).toBe(false);
    expect(result.contactId).toBe(0);
  });

  it("requests the additional-emails field id in fields", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      contacts: [{ id: 1, name: "John", lastname: "Doe" }],
    });

    await planfixSearchContact({ email: "john@example.com" });

    const call = mockPlanfixRequest.mock.calls[0][0];
    const body = call.body as any;
    expect(String(body.fields)).toContain("124");
  });

  it("finds contact via field-124 filter when main email field misses", async () => {
    // 1: byEmail (primary) miss
    // 2: field-124 with primary miss
    // 3: field-124 with additional -> hit
    mockPlanfixRequest
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({
        contacts: [{ id: 7, name: "Multi", lastname: "Mail" }],
      });

    const result = await planfixSearchContact({
      email: "primary@example.com",
      additionalEmails: ["Second@Example.com"],
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(3);
    const field124Call = mockPlanfixRequest.mock.calls[2][0];
    const body = field124Call.body as any;
    expect(body.filters[0]).toMatchObject({
      type: 4101,
      field: 124,
      operator: "equal",
      value: "second@example.com",
    });
    expect(result.contactId).toBe(7);
    expect(result.found).toBe(true);
  });

  it("matches an additional email against the main email field (4026)", async () => {
    // 1: byEmail (primary) miss
    // 2: field-124 primary miss
    // 3: field-124 additional miss
    // 4: main field (4026) with additional -> hit
    mockPlanfixRequest
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({
        contacts: [{ id: 9, name: "Alt", lastname: "Mail" }],
      });

    const result = await planfixSearchContact({
      email: "primary@example.com",
      additionalEmails: ["alt@example.com"],
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(4);
    const mainFieldCall = mockPlanfixRequest.mock.calls[3][0];
    const body = mainFieldCall.body as any;
    expect(body.filters[0]).toMatchObject({
      type: 4026,
      operator: "equal",
      value: "alt@example.com",
    });
    expect(result.contactId).toBe(9);
    expect(result.found).toBe(true);
  });

  it("searches by telegram URL with value https://t.me/<username> (no lowercase)", async () => {
    mockPlanfixRequest
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({
        contacts: [{ id: 42, name: "User", lastname: "Name" }],
      });

    const result = await planfixSearchContact({
      telegram: "iiirrrrrraaaaa",
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(5);
    const byTelegramUrlCall = mockPlanfixRequest.mock.calls[4][0];
    const body = (
      byTelegramUrlCall.body as { filters: Array<{ value: string }> }
    ).filters[0];
    expect(body.value).toBe("https://t.me/iiirrrrrraaaaa");
    expect(result.contactId).toBe(42);
    expect(result.found).toBe(true);
  });

  it("searches by telegram URL preserving case for @username input", async () => {
    mockPlanfixRequest
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({
        contacts: [{ id: 1, name: "Some", lastname: "User" }],
      });

    const result = await planfixSearchContact({
      telegram: "@SomeUser",
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(5);
    const byTelegramUrlCall = mockPlanfixRequest.mock.calls[4][0];
    const body = (
      byTelegramUrlCall.body as { filters: Array<{ value: string }> }
    ).filters[0];
    expect(body.value).toBe("https://t.me/SomeUser");
    expect(result.contactId).toBe(1);
    expect(result.found).toBe(true);
  });
});
