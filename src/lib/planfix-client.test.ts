import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanfixClient } from "./planfix-client.js";
import { planfixRequest } from "../helpers.js";

vi.mock("../helpers.js", () => ({
  planfixRequest: vi.fn(),
}));

const mockedRequest = vi.mocked(planfixRequest);

describe("PlanfixClient", () => {
  let client: PlanfixClient;
  beforeEach(() => {
    client = new PlanfixClient();
    vi.clearAllMocks();
  });

  it("sends GET requests with params", async () => {
    mockedRequest.mockResolvedValueOnce({ ok: true });
    const result = await client.get("path", { a: 1 });
    expect(mockedRequest).toHaveBeenCalledWith({
      path: "path",
      body: { a: 1 },
      method: "GET",
    });
    expect(result).toEqual({ ok: true });
  });

  it("sends POST requests", async () => {
    mockedRequest.mockResolvedValueOnce({ success: true });
    const data = { foo: "bar" };
    const result = await client.post("items", data);
    expect(mockedRequest).toHaveBeenCalledWith({
      path: "items",
      body: data,
      method: "POST",
    });
    expect(result).toEqual({ success: true });
  });

  it("sends other methods using POST and _method", async () => {
    mockedRequest.mockResolvedValueOnce({ patched: true });
    const result = await client.patch("item/1", { foo: "bar" });
    expect(mockedRequest).toHaveBeenCalledWith({
      path: "item/1",
      body: { foo: "bar", _method: "PATCH" },
      method: "POST",
    });
    expect(result).toEqual({ patched: true });
  });

  it("throws error when request fails", async () => {
    const error = new Error("oops");
    mockedRequest.mockRejectedValueOnce(error);
    await expect(client.get("x")).rejects.toThrow(error);
  });
});
