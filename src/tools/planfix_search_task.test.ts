import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({
  PLANFIX_FIELD_IDS: { client: 200, leadId: 100 },
}));

vi.mock("../customFieldsConfig.js", () => ({
  customFieldsConfig: { leadTaskFields: [] },
  proxyUrl: "",
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

// Client field (id 200 in the mocked config) as task/list returns it
const ofClient = (clientId: number) => ({
  customFieldData: [
    {
      field: { id: 200 },
      value: { id: `contact:${clientId}`, name: "Client" },
    },
  ],
});

beforeEach(() => {
  process.env.PLANFIX_LEAD_TEMPLATE_ID = "42";
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
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
    expect((call.body as any).filters[0]).toMatchObject({
      field: 100,
      value: 1,
    });
    expect(res).toEqual({
      taskId: 5,
      assignees: { users: [] },
      url: "https://example.com/task/5",
      found: true,
      totalTasks: 1,
    });
  });

  it("falls back to clientId when lead search fails", async () => {
    mockPlanfixRequest
      .mockResolvedValueOnce({ tasks: [] })
      .mockResolvedValueOnce({ tasks: [{ id: 2, ...ofClient(3) }] });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ leadId: 1, clientId: 3 });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    const second = mockPlanfixRequest.mock.calls[1][0];
    expect((second.body as any).filters[0]).toMatchObject({
      field: 200,
      value: "contact:3",
    });
    expect(res.taskId).toBe(2);
    expect(res.found).toBe(true);
    expect(res.totalTasks).toBe(1);
  });

  it("returns found false when no task is found", async () => {
    mockPlanfixRequest.mockResolvedValue({ tasks: [] });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ taskTitle: "missing" });

    expect(mockPlanfixRequest).toHaveBeenCalled();
    expect(res.found).toBe(false);
    expect(res.taskId).toBe(0);
    expect(res.url).toBe("");
    expect(res.totalTasks).toBe(0);
  });

  it("handles request errors", async () => {
    mockPlanfixRequest.mockRejectedValueOnce(new Error("fail"));
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ taskTitle: "err" });

    expect(res.found).toBe(false);
    expect(res.taskId).toBe(0);
    expect(res.url).toBe("");
    expect(res.totalTasks).toBe(0);
    expect(res.error).toContain("fail");
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

  it("uses provided templateId", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({ tasks: [{ id: 7 }] });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    await searchPlanfixTask({ leadId: 1, templateId: 99 });

    const call = mockPlanfixRequest.mock.calls[0][0];
    expect((call.body as any).filters[0]).toMatchObject({ value: 99 });
  });

  it("requests task status", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({ tasks: [] });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    await searchPlanfixTask({ clientId: 3 });

    const call = mockPlanfixRequest.mock.calls[0][0];
    expect((call.body as any).fields.split(",")).toContain("status");
  });

  it("prefers the most advanced active lead of the client over closed ones", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      tasks: [
        { id: 10, status: { id: 1 }, ...ofClient(3) }, // Новая
        { id: 11, status: { id: 205 }, ...ofClient(3) }, // Коммерческое предложение
        { id: 12, status: { id: 263 }, ...ofClient(3) }, // Первый звонок
        { id: 13, status: { id: 255 }, ...ofClient(3) }, // Не клиент или дубль
        { id: 14, status: { id: 3 }, ...ofClient(3) }, // Завершенная
      ],
    });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ clientId: 3, templateId: 42 });

    expect(res.taskId).toBe(11);
    expect(res.found).toBe(true);
    expect(res.totalTasks).toBe(5);
  });

  it("breaks a funnel tie in favour of the older lead", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      tasks: [
        { id: 931658, status: { id: 1 }, ...ofClient(24040) },
        { id: 931655, status: { id: 1 }, ...ofClient(24040) },
      ],
    });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ clientId: 24040, templateId: 42 });

    expect(res.taskId).toBe(931655);
  });

  it("does not return a closed lead while an active one exists", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      tasks: [
        { id: 1, status: { id: 999 }, ...ofClient(3) }, // unknown status, still active
        { id: 2, status: { id: 245 }, ...ofClient(3) }, // Клиент ничего не купил
        { id: 3, status: { id: 4 }, ...ofClient(3) }, // Отложенная
      ],
    });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ clientId: 3, templateId: 42 });

    expect(res.taskId).toBe(1);
  });

  it("falls back to the last lead when all of them are closed", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      tasks: [
        { id: 5, status: { id: 3 }, ...ofClient(3) },
        { id: 4, status: { id: 255 }, ...ofClient(3) },
      ],
    });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ clientId: 3, templateId: 42 });

    expect(res.taskId).toBe(4);
  });

  it("keeps the last task for client searches outside the lead template", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      tasks: [
        { id: 7, status: { id: 2 }, ...ofClient(3) },
        { id: 8, status: { id: 3 }, ...ofClient(3) },
      ],
    });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ clientId: 3, templateId: 99 });

    expect(res.taskId).toBe(8);
  });

  it("reports a failed client search as an error instead of a miss", async () => {
    mockPlanfixRequest.mockRejectedValueOnce(new Error("timeout"));
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ clientId: 3, taskTitle: "Lead" });

    expect(res.found).toBe(false);
    expect(res.taskId).toBe(0);
    expect(res.error).toContain("timeout");
    // No fallback to the title search: it could pick another client's task.
    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
  });
  it("requests the client field to check client search results", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({ tasks: [] });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    await searchPlanfixTask({ clientId: 3 });

    const call = mockPlanfixRequest.mock.calls[0][0];
    expect((call.body as any).fields.split(",")).toContain("200");
  });

  it("drops leads of other clients when Planfix ignores the client filter", async () => {
    // Planfix returns 100 unrelated leads for a nonexistent contact id
    mockPlanfixRequest.mockResolvedValueOnce({
      tasks: [
        {
          id: 644124,
          status: { id: 1 },
          customFieldData: [{ field: { id: 200 } }],
        },
        { id: 644152, status: { id: 205 }, ...ofClient(17972) },
        { id: 644471, status: { id: 263 } },
      ],
    });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ clientId: 99999999, templateId: 42 });

    expect(res.found).toBe(false);
    expect(res.taskId).toBe(0);
    expect(res.totalTasks).toBe(0);
  });

  it("keeps only the client's own leads from a mixed result", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      tasks: [
        { id: 20, status: { id: 205 }, ...ofClient(17972) },
        { id: 21, status: { id: 1 }, ...ofClient(3) },
      ],
    });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ clientId: 3, templateId: 42 });

    expect(res.taskId).toBe(21);
    expect(res.totalTasks).toBe(1);
  });

  it("does not check the client of tasks found by other filters", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({ tasks: [{ id: 30 }] });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({ taskTitle: "Lead" });

    expect(res.taskId).toBe(30);
  });
  it("with exactTitle keeps only tasks named exactly as the title", async () => {
    // Filter 8 matches a substring: "Талакина" found 892373
    mockPlanfixRequest.mockResolvedValueOnce({
      tasks: [
        { id: 40, name: "Работа с клиентом Анастасия Талакина" },
        { id: 41, name: "Работа с клиентом Анастасия Талакина 2" },
        { id: 42, name: "Звонок: Работа с клиентом Анастасия Талакина" },
      ],
    });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({
      taskTitle: "Работа с клиентом Анастасия Талакина",
      templateId: 42,
      exactTitle: true,
    });

    const call = mockPlanfixRequest.mock.calls[0][0];
    expect((call.body as any).filters).toEqual([
      { type: 51, operator: "equal", value: 42 },
      {
        type: 8,
        operator: "equal",
        value: "Работа с клиентом Анастасия Талакина",
      },
    ]);
    expect(res.taskId).toBe(40);
    expect(res.totalTasks).toBe(1);
  });

  it("with exactTitle finds nothing when only substring matches come back", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      tasks: [{ id: 50, name: "Работа с клиентом Юлия Павлова" }],
    });
    const { searchPlanfixTask } = await import("./planfix_search_task.js");

    const res = await searchPlanfixTask({
      taskTitle: "Юлия Павлова",
      exactTitle: true,
    });

    expect(res.found).toBe(false);
    expect(res.taskId).toBe(0);
  });
});
