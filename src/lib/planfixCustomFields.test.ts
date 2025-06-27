import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTaskCustomFieldName } from "./planfixCustomFields.js";
import { planfixRequest, log } from "../helpers.js";

vi.mock("../helpers.js", () => ({
  planfixRequest: vi.fn(),
  log: vi.fn(),
}));

const mockedRequest = vi.mocked(planfixRequest);
const mockedLog = vi.mocked(log);

describe("getTaskCustomFieldName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the field name when found", async () => {
    mockedRequest.mockResolvedValueOnce({
      customfields: [{ id: 1, name: "Field" }],
    });
    const name = await getTaskCustomFieldName(1);
    expect(name).toBe("Field");
    expect(mockedRequest).toHaveBeenCalledWith({
      path: `customfield/task`,
      method: "GET",
      body: { fields: "id,name" },
      cacheTime: 3600,
    });
  });

  it("returns undefined when field not found", async () => {
    mockedRequest.mockResolvedValueOnce({ customfields: [] });
    const name = await getTaskCustomFieldName(2);
    expect(name).toBeUndefined();
  });

  it("logs and returns undefined on error", async () => {
    const err = new Error("fail");
    mockedRequest.mockRejectedValueOnce(err);
    const name = await getTaskCustomFieldName(1);
    expect(name).toBeUndefined();
    expect(mockedLog).toHaveBeenCalledWith(
      `[getTaskCustomFieldName] ${err.message}`,
    );
  });
});
