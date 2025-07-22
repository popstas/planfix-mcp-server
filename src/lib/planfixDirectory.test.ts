import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getDirectoryFields,
  searchDirectoryEntryById,
  searchAllDirectoryEntries,
  searchDirectory,
  createDirectoryEntry,
  addDirectoryEntry,
  addDirectoryEntries,
} from "./planfixDirectory.js";
import { log, planfixRequest } from "../helpers.js";
import { getFieldDirectoryId } from "./planfixObjects.js";
import type { CustomFieldDataType } from "../types.js";

vi.mock("../helpers.js", () => ({
  log: vi.fn(),
  planfixRequest: vi.fn(),
}));
const deletePrefixMock = vi.fn();
vi.mock("./cache.js", () => ({
  getCacheProvider: () => ({ deletePrefix: deletePrefixMock }),
}));
vi.mock("./planfixObjects.js", () => ({
  getFieldDirectoryId: vi.fn(),
}));

const mockedLog = vi.mocked(log);
const mockedPlanfixRequest = vi.mocked(planfixRequest);
const mockedGetFieldDirectoryId = vi.mocked(getFieldDirectoryId);

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
    expect(mockedLog).toHaveBeenCalledWith(
      `[getDirectoryFields] ${error.message}`,
    );
  });
});

describe("searchDirectoryEntryById", () => {
  const dirId = 1;
  const fieldId = 2;
  const entryName = "Test";
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("returns entry key when found", async () => {
    mockedPlanfixRequest.mockResolvedValueOnce({
      directoryEntries: [
        {
          key: 5,
          customFieldData: [{ field: { id: fieldId }, value: entryName }],
        },
      ],
    });
    const result = await searchDirectoryEntryById(dirId, fieldId, entryName);
    expect(mockedPlanfixRequest).toHaveBeenCalledWith({
      path: `directory/${dirId}/entry/list`,
      method: "POST",
      body: {
        offset: 0,
        pageSize: 100,
        fields: `directory,parentKey,name,key,${fieldId}`,
        entriesOnly: true,
      },
      cacheTime: 3600,
    });
    expect(result).toBe(5);
  });

  it("logs error and returns undefined on failure", async () => {
    const error = new Error("fail");
    mockedPlanfixRequest.mockRejectedValueOnce(error);
    const result = await searchDirectoryEntryById(dirId, fieldId, entryName);
    expect(result).toBeUndefined();
    expect(mockedLog).toHaveBeenCalledWith(
      `[searchDirectoryEntryById] ${error.message}`,
    );
  });
});

describe("searchAllDirectoryEntries", () => {
  const dirId = 3;
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("returns entries", async () => {
    const entries = [{ key: 1 }];
    mockedPlanfixRequest.mockResolvedValueOnce({ directoryEntries: entries });
    const result = await searchAllDirectoryEntries(dirId);
    expect(result).toEqual(entries);
  });

  it("returns undefined on error", async () => {
    mockedPlanfixRequest.mockRejectedValueOnce(new Error("boom"));
    const result = await searchAllDirectoryEntries(dirId);
    expect(result).toBeUndefined();
    expect(mockedLog).toHaveBeenCalled();
  });
});

describe("searchDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("finds directory by name", async () => {
    mockedPlanfixRequest.mockResolvedValueOnce({
      directories: [
        { id: 7, name: "A" },
        { id: 8, name: "B" },
      ],
    });
    const result = await searchDirectory("B");
    expect(result).toEqual({ id: 8, name: "B" });
  });

  it("logs error and returns undefined", async () => {
    const err = new Error("oops");
    mockedPlanfixRequest.mockRejectedValueOnce(err);
    const result = await searchDirectory("B");
    expect(result).toBeUndefined();
    expect(mockedLog).toHaveBeenCalledWith(`[searchDirectory] ${err.message}`);
  });
});

describe("createDirectoryEntry", () => {
  const dirId = 9;
  const fieldId = 10;
  const name = "Item";
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("returns created key", async () => {
    mockedPlanfixRequest.mockResolvedValueOnce({ key: 12 });
    const result = await createDirectoryEntry(dirId, fieldId, name);
    expect(mockedPlanfixRequest).toHaveBeenCalled();
    expect(result).toBe(12);
    expect(deletePrefixMock).toHaveBeenCalledWith(`directory/${dirId}`);
  });
  it("handles entry object response", async () => {
    mockedPlanfixRequest.mockResolvedValueOnce({ entry: { key: 13 } });
    const result = await createDirectoryEntry(dirId, fieldId, name);
    expect(result).toBe(13);
    expect(deletePrefixMock).toHaveBeenCalledWith(`directory/${dirId}`);
  });
  it("returns undefined on error", async () => {
    mockedPlanfixRequest.mockRejectedValueOnce(new Error("err"));
    const result = await createDirectoryEntry(dirId, fieldId, name);
    expect(result).toBeUndefined();
    expect(mockedLog).toHaveBeenCalled();
    expect(deletePrefixMock).not.toHaveBeenCalled();
  });
});

describe("addDirectoryEntry", () => {
  const objectId = 1;
  const fieldId = 2;
  const value = "Item";
  const postBody: { customFieldData?: CustomFieldDataType[] } = {};

  beforeEach(() => {
    vi.clearAllMocks();
    postBody.customFieldData = [];
  });

  it("adds existing entry", async () => {
    mockedGetFieldDirectoryId.mockResolvedValueOnce(10);
    mockedPlanfixRequest.mockResolvedValueOnce({
      directory: { id: 10, name: "Dir", fields: [{ id: 5 }] },
    });
    mockedPlanfixRequest.mockResolvedValueOnce({
      directoryEntries: [
        { key: 7, customFieldData: [{ field: { id: 5 }, value }] },
      ],
    });
    const id = await addDirectoryEntry({ objectId, fieldId, value, postBody });
    expect(id).toBe(7);
    expect(postBody.customFieldData).toEqual([
      { field: { id: fieldId }, value: { id: 7 } },
    ]);
  });

  it("creates entry when missing", async () => {
    mockedGetFieldDirectoryId.mockResolvedValueOnce(10);
    mockedPlanfixRequest.mockResolvedValueOnce({
      directory: { id: 10, name: "Dir", fields: [{ id: 5 }] },
    });
    mockedPlanfixRequest.mockResolvedValueOnce({ directoryEntries: [] });
    mockedPlanfixRequest.mockResolvedValueOnce({ key: 8 });
    const id = await addDirectoryEntry({ objectId, fieldId, value, postBody });
    expect(id).toBe(8);
    expect(postBody.customFieldData?.[0]).toEqual({
      field: { id: fieldId },
      value: { id: 8 },
    });
  });

  it("returns undefined if directory not found", async () => {
    mockedGetFieldDirectoryId.mockResolvedValueOnce(undefined);
    const id = await addDirectoryEntry({ objectId, fieldId, value, postBody });
    expect(id).toBeUndefined();
    expect(postBody.customFieldData?.length).toBe(0);
  });
});

describe("addDirectoryEntries", () => {
  const objectId = 2;
  const fieldId = 3;
  const values = ["A", "B"];
  const postBody: { customFieldData?: CustomFieldDataType[] } = {};

  beforeEach(() => {
    vi.clearAllMocks();
    postBody.customFieldData = [];
  });

  it("adds ids for values", async () => {
    mockedGetFieldDirectoryId.mockResolvedValueOnce(20);
    mockedPlanfixRequest.mockResolvedValueOnce({
      directory: { id: 20, name: "Dir", fields: [{ id: 6 }] },
    });
    mockedPlanfixRequest.mockResolvedValueOnce({
      directoryEntries: [
        { key: 1, customFieldData: [{ field: { id: 6 }, value: "A" }] },
      ],
    });
    mockedPlanfixRequest.mockResolvedValueOnce({ directoryEntries: [] });
    mockedPlanfixRequest.mockResolvedValueOnce({ key: 2 });
    const ids = await addDirectoryEntries({
      objectId,
      fieldId,
      values,
      postBody,
    });
    expect(ids).toEqual([1, 2]);
    expect(postBody.customFieldData?.[0]).toEqual({
      field: { id: fieldId },
      value: [{ id: 1 }, { id: 2 }],
    });
  });

  it("returns undefined when directory missing", async () => {
    mockedGetFieldDirectoryId.mockResolvedValueOnce(undefined);
    const ids = await addDirectoryEntries({
      objectId,
      fieldId,
      values,
      postBody,
    });
    expect(ids).toBeUndefined();
    expect(postBody.customFieldData?.length).toBe(0);
  });
});
