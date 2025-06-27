import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({
  PLANFIX_FIELD_IDS: { client: 200, leadId: 100 },
}));

vi.mock("../customFieldsConfig.js", () => ({
  customFieldsConfig: { leadTaskFields: [] },
}));

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn(),
    getTaskUrl: (id?: number) => (id ? `https://example.com/task/${id}` : ""),
  };
});

import { planfixRequest } from "../helpers.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);

beforeEach(() => {
  process.env.PLANFIX_LEAD_TEMPLATE_ID = "42";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("searchPlanfixTask", () => {
  it("searches by leadId", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      tasks: [{ id: 5, assignees: { users: [] }, description: "desc" }],
    });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ leadId: 1 });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    const call = mockPlanfixRequest.mock.calls[0][0];
    expect((call.body as any).filters[1]).toMatchObject({
      field: 100,
      value: 1,
    });
    expect(res).toEqual({
      taskId: 5,
      assignees: { users: [] },
      url: "https://example.com/task/5",
      found: true,
    });
  });

  it("falls back to clientId when lead search fails", async () => {
    mockPlanfixRequest
      .mockResolvedValueOnce({ tasks: [] })
      .mockResolvedValueOnce({ tasks: [{ id: 2 }] });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ leadId: 1, clientId: 3 });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    const second = mockPlanfixRequest.mock.calls[1][0];
    expect((second.body as any).filters[1]).toMatchObject({
      field: 200,
      value: "contact:3",
    });
    expect(res.taskId).toBe(2);
    expect(res.found).toBe(true);
  });

  it("returns found false when no task is found", async () => {
    mockPlanfixRequest.mockResolvedValue({ tasks: [] });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ taskTitle: "missing" });

    expect(mockPlanfixRequest).toHaveBeenCalled();
    expect(res.found).toBe(false);
    expect(res.taskId).toBe(0);
    expect(res.url).toBe("");
  });

  it("handles request errors", async () => {
    mockPlanfixRequest.mockRejectedValueOnce(new Error("fail"));
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ taskTitle: "err" });

    expect(res.found).toBe(false);
    expect(res.taskId).toBe(0);
    expect(res.url).toBe("");
  });

  it("handler parses args", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({ tasks: [{ id: 10 }] });
    const tool = await import("./planfix_search_task.js");

    const res = (await tool.planfixSearchTaskTool.handler({
      leadId: 1,
    })) as any;

    expect(res.taskId).toBe(10);
    expect(mockPlanfixRequest).toHaveBeenCalled();
  });
});
