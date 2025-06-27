import { afterEach, describe, expect, it, vi } from "vitest";

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
import { planfixSearchCompany } from "./planfix_search_company.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);

describe("planfixSearchCompany", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns company when found by name", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      contacts: [{ id: 5, name: "Acme" }],
    });

    const result = (await planfixSearchCompany({ name: "Acme" })) as any;

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    const call = mockPlanfixRequest.mock.calls[0][0];
    expect(call.path).toBe("contact/list");
    const body = call.body as any;
    expect(body.filters).toContainEqual({
      type: 4001,
      operator: "equal",
      value: "Acme",
    });
    expect(result).toEqual({
      contactId: 5,
      url: "https://example.com/contact/5",
      name: "Acme",
      error: undefined,
    });
  });

  it("returns not found when company absent", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({ contacts: [] });

    const result = (await planfixSearchCompany({ name: "None" })) as any;

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    expect(result.contactId).toBe(0);
    expect(result.name).toBeUndefined();
  });

  it("handles API errors", async () => {
    mockPlanfixRequest.mockRejectedValueOnce(new Error("API fail"));

    const result = (await planfixSearchCompany({ name: "Boom" })) as any;

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    expect(result.contactId).toBe(0);
    expect(result.error).toBe("API fail");
  });
});
