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
    mockPlanfixRequest
      .mockRejectedValueOnce(new Error("API fail"))
      .mockRejectedValueOnce(new Error("API fail"));

    const result = await planfixSearchContact({ email: "err@example.com" });

    // 4026 (primary) then the 4221 secondary-email fallback
    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    expect(result.contactId).toBe(0);
    expect(result.error).toBeUndefined();
    expect(result.found).toBe(false);
  });

  it("falls back to the secondary-email filter (4221) for a single email", async () => {
    // 1: byEmail (4026) miss
    // 2: 4221 with the same email -> hit
    mockPlanfixRequest.mockResolvedValueOnce({ contacts: [] }).mockResolvedValueOnce({
      contacts: [{ id: 11, name: "Sec", lastname: "Ondary" }],
    });

    const result = await planfixSearchContact({ email: "Miss@Example.com" });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    const body = mockPlanfixRequest.mock.calls[1][0].body as any;
    expect(body.filters[0]).toMatchObject({
      type: 4221,
      operator: "equal",
      value: "miss@example.com",
    });
    expect(body.filters[0].field).toBeUndefined();
    expect(result.contactId).toBe(11);
    expect(result.found).toBe(true);
  });

  it("does not query the custom field (4101) when no additionalEmails are given", async () => {
    // 1: byEmail (4026) miss, 2: 4221 miss => stop, custom-field tier stays gated
    mockPlanfixRequest
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] });

    const result = await planfixSearchContact({ email: "miss@example.com" });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    const types = mockPlanfixRequest.mock.calls.map(
      (call) => (call[0].body as any).filters[0].type,
    );
    expect(types).toEqual([4026, 4221]);
    expect(result.found).toBe(false);
    expect(result.contactId).toBe(0);
  });

  it("does not repeat the primary 4026 query when an additional email equals it", async () => {
    mockPlanfixRequest.mockResolvedValue({ contacts: [] });

    const result = await planfixSearchContact({
      email: "same@example.com",
      additionalEmails: ["Same@example.com"],
    });

    // 4026 primary, 4221 primary, 4101 primary — the duplicate additional is
    // deduped away, so no second 4026 query is made.
    const calls = mockPlanfixRequest.mock.calls.map((call) => {
      const filter = (call[0].body as any).filters[0];
      return { type: filter.type, value: filter.value };
    });
    expect(calls).toEqual([
      { type: 4026, value: "same@example.com" },
      { type: 4221, value: "same@example.com" },
      { type: 4101, value: "same@example.com" },
    ]);
    expect(result.found).toBe(false);
  });

  it("requests the additional-emails fields (system + custom id) in fields", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      contacts: [{ id: 1, name: "John", lastname: "Doe" }],
    });

    await planfixSearchContact({ email: "john@example.com" });

    const call = mockPlanfixRequest.mock.calls[0][0];
    const body = call.body as any;
    // System secondary-email field is always requested...
    expect(String(body.fields)).toContain("additionalEmailAddresses");
    // ...and the optional numeric custom field id when configured.
    expect(String(body.fields)).toContain("124");
  });

  it("finds contact via the system secondary-email filter (4221)", async () => {
    // 1: byEmail (primary) miss
    // 2: 4221 with primary miss
    // 3: 4221 with additional -> hit
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
    const secondaryCall = mockPlanfixRequest.mock.calls[2][0];
    const body = secondaryCall.body as any;
    expect(body.filters[0]).toMatchObject({
      type: 4221,
      operator: "equal",
      value: "second@example.com",
    });
    // System filter carries no numeric `field` id.
    expect(body.filters[0].field).toBeUndefined();
    expect(result.contactId).toBe(7);
    expect(result.found).toBe(true);
  });

  it("falls back to the custom field (4101) when the system field misses", async () => {
    // 1: byEmail (primary) miss
    // 2: 4221 primary miss
    // 3: 4221 additional miss
    // 4: custom field (4101) primary miss
    // 5: custom field (4101) additional -> hit
    mockPlanfixRequest
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({
        contacts: [{ id: 7, name: "Multi", lastname: "Mail" }],
      });

    const result = await planfixSearchContact({
      email: "primary@example.com",
      additionalEmails: ["Second@Example.com"],
    });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(5);
    const field124Call = mockPlanfixRequest.mock.calls[4][0];
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
    // 2: 4221 primary miss
    // 3: 4221 additional miss
    // 4: custom field (4101) primary miss
    // 5: custom field (4101) additional miss
    // 6: main field (4026) with additional -> hit
    mockPlanfixRequest
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
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

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(6);
    const mainFieldCall = mockPlanfixRequest.mock.calls[5][0];
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
