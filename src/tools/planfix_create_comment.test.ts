import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn().mockResolvedValue({ id: 123 }),
    log: vi.fn(),
  };
});

vi.mock("../config.js", () => ({ PLANFIX_DRY_RUN: false }));

import { planfixRequest } from "../helpers.js";
import { createComment, handler } from "./planfix_create_comment.js";

const mockRequest = vi.mocked(planfixRequest);

describe("createComment", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("handles dry run", async () => {
    const original = await import("../config.js");
    vi.resetModules();
    vi.doMock("../config.js", () => ({ ...original, PLANFIX_DRY_RUN: true }));
    const { createComment: createDry } = await import(
      "./planfix_create_comment.js"
    );
    const result = await createDry({ taskId: 1, description: "hi" });
    expect(result.commentId).toBeGreaterThan(0);
    expect(mockRequest).not.toHaveBeenCalled();
    vi.resetModules();
  });

  it("sends request with default recipients", async () => {
    const result = await createComment({
      taskId: 1,
      description: "Hello\nworld",
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const call = mockRequest.mock.calls[0][0];
    expect(call.path).toBe("task/1/comments/");
    expect((call.body as any).description).toBe("Hello<br>world");
    expect((call.body as any).recipients).toEqual({ roles: ["assignee"] });
    expect(result.commentId).toBe(123);
  });

  it("omits recipients when silent", async () => {
    await createComment({ taskId: 2, description: "ok", silent: true });
    const body = mockRequest.mock.calls[0][0].body as any;
    expect(body.recipients).toBeUndefined();
  });

  it("returns error on request failure", async () => {
    mockRequest.mockRejectedValueOnce(new Error("fail"));
    const result = await createComment({ taskId: 3, description: "no" });
    expect(result.commentId).toBe(0);
    expect(result.error).toContain("fail");
  });
});

describe("handler", () => {
  it("parses args", async () => {
    const res = await handler({ taskId: 4, description: "h" });
    expect(res.commentId).toBe(123);
    expect(mockRequest).toHaveBeenCalled();
  });
});
