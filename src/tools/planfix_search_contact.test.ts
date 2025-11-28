import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({
  PLANFIX_FIELD_IDS: {
    telegram: 131,
    telegramCustom: 0,
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
});
