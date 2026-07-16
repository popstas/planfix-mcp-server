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

import { PLANFIX_FIELD_IDS } from "../config.js";
import { planfixRequest } from "../helpers.js";
import { planfixSearchContact } from "./planfix_search_contact.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);

describe("planfixSearchContact", () => {
  afterEach(() => {
    vi.clearAllMocks();
    PLANFIX_FIELD_IDS.emailAdditional = 124;
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

  it("queries the primary email field with the trimmed address, keeping case", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      contacts: [{ id: 1, name: "John", lastname: "Doe" }],
    });

    await planfixSearchContact({ email: "  John@Example.COM " });

    const body = mockPlanfixRequest.mock.calls[0][0].body as any;
    expect(body.filters[0]).toMatchObject({
      type: 4026,
      value: "John@Example.COM",
    });
  });

  it("retries a mixed-case primary against 4026 in normalized form", async () => {
    mockPlanfixRequest.mockResolvedValue({ contacts: [] });

    await planfixSearchContact({ email: "John@Example.COM" });

    const emailFilters = mockPlanfixRequest.mock.calls
      .map((c) => (c[0].body as any).filters[0])
      .filter((f) => f.type === 4026);
    expect(emailFilters.map((f) => f.value)).toEqual([
      "John@Example.COM",
      "john@example.com",
    ]);
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
      .mockRejectedValueOnce(new Error("API fail"))
      .mockRejectedValueOnce(new Error("API fail"));

    const result = await planfixSearchContact({ email: "err@example.com" });

    // 4026 (primary), then the 4221 and 4101 fallbacks
    expect(mockPlanfixRequest).toHaveBeenCalledTimes(3);
    expect(result.contactId).toBe(0);
    // A rejected filter must not be reported as a clean "not found": callers
    // would create a duplicate contact instead of surfacing the failure.
    expect(result.error).toBe("API fail");
    expect(result.found).toBe(false);
  });

  it("does not report an error when a later filter matches", async () => {
    // 1: byEmail (4026) rejected, 2: 4221 hit
    mockPlanfixRequest
      .mockRejectedValueOnce(new Error("filter rejected"))
      .mockResolvedValueOnce({
        contacts: [{ id: 12, name: "Sec", lastname: "Ondary" }],
      });

    const result = await planfixSearchContact({ email: "hit@example.com" });

    expect(result.contactId).toBe(12);
    expect(result.found).toBe(true);
    // The failed tier did not affect the outcome.
    expect(result.error).toBeUndefined();
  });

  it("does not report an error when only a fallback email tier fails", async () => {
    // 1: byEmail (4026) clean miss, 2: 4221 rejected, 3: 4101 clean miss.
    // The authoritative primary-email field answered, so the rejected fallback
    // must degrade to "not found" rather than block the caller from creating a
    // contact — an account that rejects 4221 would otherwise never create one.
    mockPlanfixRequest
      .mockResolvedValueOnce({ contacts: [] })
      .mockRejectedValueOnce(new Error("filter type 4221 not supported"))
      .mockResolvedValueOnce({ contacts: [] });

    const result = await planfixSearchContact({ email: "miss@example.com" });

    expect(result.contactId).toBe(0);
    expect(result.found).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it("reports an error when the primary email filter fails", async () => {
    // The 4026 tier is authoritative: its failure means a matching contact may
    // exist unseen, so the miss must not be reported as clean.
    mockPlanfixRequest
      .mockRejectedValueOnce(new Error("4026 rejected"))
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] });

    const result = await planfixSearchContact({ email: "err@example.com" });

    expect(result.contactId).toBe(0);
    expect(result.error).toBe("4026 rejected");
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

  it("matches a lone email against the custom field (4101) when configured", async () => {
    // The custom field is the only place this server writes extras to, so an
    // email search must reach it even with no additionalEmails argument —
    // otherwise a contact we created ourselves would not be found.
    // 1: byEmail (4026) miss, 2: 4221 miss, 3: 4101 hit
    mockPlanfixRequest
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({ contacts: [] })
      .mockResolvedValueOnce({
        contacts: [{ id: 12, name: "Cust", lastname: "Field" }],
      });

    const result = await planfixSearchContact({ email: "Miss@Example.com" });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(3);
    const body = mockPlanfixRequest.mock.calls[2][0].body as any;
    expect(body.filters[0]).toMatchObject({
      type: 4101,
      field: 124,
      operator: "equal",
      value: "miss@example.com",
    });
    expect(result.contactId).toBe(12);
    expect(result.found).toBe(true);
  });

  it("does not query the custom field (4101) when it is not configured", async () => {
    PLANFIX_FIELD_IDS.emailAdditional = 0;
    mockPlanfixRequest.mockResolvedValue({ contacts: [] });

    const result = await planfixSearchContact({
      email: "miss@example.com",
      additionalEmails: ["extra@example.com"],
    });

    const types = mockPlanfixRequest.mock.calls.map(
      (call) => (call[0].body as any).filters[0].type,
    );
    expect(types).not.toContain(4101);
    // 4026 primary, 4221 for both addresses, then 4026 for the extra only
    expect(types).toEqual([4026, 4221, 4221, 4026]);
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

  it("does not query the email field for a whitespace-only email", async () => {
    mockPlanfixRequest.mockResolvedValue({ contacts: [] });

    const result = await planfixSearchContact({ email: "   " });

    // An `equal ""` query could match any contact with an empty email field, so
    // the address must be dropped entirely rather than normalized to "".
    expect(mockPlanfixRequest).not.toHaveBeenCalled();
    expect(result.found).toBe(false);
    expect(result.contactId).toBe(0);
  });

  it("does not request the additional-emails fields it never reads", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      contacts: [{ id: 1, name: "John", lastname: "Doe" }],
    });

    await planfixSearchContact({ email: "john@example.com" });

    const call = mockPlanfixRequest.mock.calls[0][0];
    const fields = String((call.body as any).fields).split(",");
    // Additional emails are matched via filters (4221/4101); the response is
    // only read for id/name/telegram, so neither field is requested.
    expect(fields).not.toContain("additionalEmailAddresses");
    expect(fields).not.toContain("124");
    // The fields actually consumed are still requested.
    expect(fields).toContain("id");
    expect(fields).toContain("name");
    expect(fields).toContain("lastname");
    expect(fields).toContain("telegram");
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
