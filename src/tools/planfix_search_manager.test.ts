import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../customFieldsConfig.js", () => ({
  customFieldsConfig: {
    userFields: [
      { id: 10, argName: "department", type: "enum", values: ["sales"] },
      { id: 11, argName: "active", type: "boolean" },
    ],
  },
  proxyUrl: "",
}));

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn(),
    getUserUrl: (id: number) => `https://example.com/user/${id}`,
    log: vi.fn(),
  };
});

import { planfixRequest } from "../helpers.js";
import {
  SearchManagerInputSchema,
  searchManager,
} from "./planfix_search_manager.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);

describe("searchManager", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes custom user fields as filters and returns them", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      users: [
        {
          id: 5,
          name: "Ann",
          lastname: "Manager",
          customFieldData: [
            { field: { id: 10 }, value: "sales" },
            { field: { id: 11 }, value: true },
          ],
        },
      ],
    });

    const result = await searchManager({
      email: "ann@example.com",
      department: "sales",
    } as any);

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    const body = (mockPlanfixRequest.mock.calls[0][0] as any).body;
    expect(body.fields).toBe("id,name,midname,lastname,email,10,11");
    expect(body.filters).toEqual([
      { type: 9003, operator: "equal", value: "ann@example.com" },
      { field: 10, operator: "equal", type: 9111, value: "sales" },
    ]);
    expect(result).toEqual({
      managerId: 5,
      url: "https://example.com/user/5",
      firstName: "Ann",
      lastName: "Manager",
      found: true,
      department: "sales",
      active: true,
    });
  });

  it("searches by id without requiring email", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      users: [
        {
          id: 7,
          name: "Ida",
        },
      ],
    });

    const result = await searchManager({ id: 7 } as any);

    const body = (mockPlanfixRequest.mock.calls[0][0] as any).body;
    expect(body.filters).toEqual([{ type: 9008, operator: "equal", value: 7 }]);
    expect(result).toEqual({
      managerId: 7,
      url: "https://example.com/user/7",
      firstName: "Ida",
      lastName: undefined,
      found: true,
    });
  });

  it("requires either email or id", () => {
    expect(() =>
      SearchManagerInputSchema.parse({ department: "sales" }),
    ).toThrow("Either email or id must be provided");
  });
});
