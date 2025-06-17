import { describe, expect, it, vi, beforeEach } from "vitest";
import { getDirectoryFields } from "./planfixDirectory.js";
import { log, planfixRequest } from "../helpers.js";

// Mock the helpers module
vi.mock("../helpers.js", () => ({
  log: vi.fn(),
  planfixRequest: vi.fn(),
}));

// Create type-safe mocks
const mockedLog = vi.mocked(log);
const mockedPlanfixRequest = vi.mocked(planfixRequest);

describe("getDirectoryFields", () => {
  const mockDirectoryId = 7458;
  const mockFields = [
    { id: 23098, name: "name", type: 1, isSystem: true },
    { id: 23099, name: "description", type: 1, isRequired: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return directory fields when the API call is successful", async () => {
    // Mock successful API response
    const mockResponse = {
      directory: {
        id: mockDirectoryId,
        name: "Test Directory",
        fields: mockFields,
      },
    };
    
    mockedPlanfixRequest.mockResolvedValueOnce(mockResponse);

    const result = await getDirectoryFields(mockDirectoryId);

    expect(mockedPlanfixRequest).toHaveBeenCalledWith({
      path: `directory/${mockDirectoryId}?fields=id,name,fields`,
      method: "GET",
      cacheTime: 3600,
    });
    expect(result).toEqual(mockFields);
    expect(mockedLog).not.toHaveBeenCalled();
  });

  it("should return undefined and log error when the API call fails", async () => {
    const error = new Error("API Error");
    mockedPlanfixRequest.mockRejectedValueOnce(error);

    const result = await getDirectoryFields(mockDirectoryId);

    expect(result).toBeUndefined();
    expect(mockedLog).toHaveBeenCalledWith(`[getDirectoryFields] ${error.message}`);
  });
});
