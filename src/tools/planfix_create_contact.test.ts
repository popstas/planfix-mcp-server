import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../config.js", () => ({
  PLANFIX_DRY_RUN: false,
  PLANFIX_FIELD_IDS: {
    telegram: 100,
    telegramCustom: 1001,
  },
}));

vi.mock("../customFieldsConfig.js", () => ({
  customFieldsConfig: { contactFields: [] },
}));

vi.mock("../lib/extendPostBodyWithCustomFields.js", () => ({
  extendPostBodyWithCustomFields: vi.fn(),
}));

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn().mockResolvedValue({ id: 123 }),
    getContactUrl: (id: number) => `https://example.com/contact/${id}`,
    log: vi.fn(),
  };
});

import { planfixRequest } from "../helpers.js";
import { createPlanfixContact, handler } from "./planfix_create_contact.js";

const mockRequest = vi.mocked(planfixRequest);

describe("createPlanfixContact", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("handles dry run", async () => {
    const original = await import("../config.js");
    vi.resetModules();
    vi.doMock("../config.js", () => ({ ...original, PLANFIX_DRY_RUN: true }));
    const { createPlanfixContact: createDry } = await import(
      "./planfix_create_contact.js"
    );
    const result = await createDry({ name: "John" });
    expect(result.contactId).toBeGreaterThan(0);
    expect(result.url).toContain("https://example.com/contact/");
    expect(mockRequest).not.toHaveBeenCalled();
    vi.resetModules();
  });

  it("sends telegram as custom field", async () => {
    await createPlanfixContact({ name: "J", telegram: "@john" });
    const call = mockRequest.mock.calls[0][0];
    const body = call.body as any;
    expect(body.customFieldData).toEqual(
      expect.arrayContaining([{ field: { id: 1001 }, value: "@john" }])
    );
  });

  it("returns zero on request error", async () => {
    mockRequest.mockRejectedValueOnce(new Error("oops"));
    const result = await createPlanfixContact({ name: "J" });
    expect(result.contactId).toBe(0);
    expect(result.url).toBeUndefined();
  });
});

describe("handler", () => {
  it("parses args and calls createPlanfixContact", async () => {
    const res = await handler({ name: "Ann" });
    expect(res.contactId).toBe(123);
    expect(mockRequest).toHaveBeenCalled();
  });
});
