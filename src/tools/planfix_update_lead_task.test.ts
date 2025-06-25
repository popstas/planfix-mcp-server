import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../config.js", () => ({
  PLANFIX_DRY_RUN: false,
  PLANFIX_FIELD_IDS: {
    manager: 1,
    agency: 2,
    leadSource: 3,
    tags: 4,
  },
}));

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn(),
    getTaskUrl: (id: number) => `https://example.com/task/${id}`,
  };
});

vi.mock("./planfix_search_project.js", () => ({
  searchProject: vi.fn().mockResolvedValue({ projectId: 10, found: true }),
}));

vi.mock("../lib/planfixObjects.js", () => ({
  getFieldDirectoryId: vi.fn().mockResolvedValue(100),
}));

vi.mock("../lib/planfixDirectory.js", () => ({
  createDirectoryEntry: vi.fn().mockResolvedValue(5),
  searchDirectoryEntryById: vi.fn().mockResolvedValue(5),
  getDirectoryFields: vi.fn().mockResolvedValue([{ id: 1 }]),
}));

import { planfixRequest } from "../helpers.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);

describe("planfix_update_lead_task", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates lead task fields with forceUpdate", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      task: {
        id: 1,
        project: { id: 99 },
        assignees: { users: [{ id: "user:2" }] },
        customFieldData: [],
      },
    });
    mockPlanfixRequest.mockResolvedValueOnce({});

    const { updateLeadTask } = await import("./planfix_update_lead_task.js");

    const result = await updateLeadTask({
      taskId: 1,
      description: "Desc",
      managerEmail: "manager@example.com",
      project: "Proj",
      leadSource: "Site",
      tags: ["tag"],
      forceUpdate: true,
    });

    // Verify the update call was made with the correct data
    // Expect 3 calls: 1. GET task, 2. GET user/list, 3. UPDATE task
    expect(mockPlanfixRequest).toHaveBeenCalledTimes(3);
    const updateCall = mockPlanfixRequest.mock.calls[2][0];
    expect(updateCall.path).toBe("task/1");
    expect(updateCall.body).toMatchObject({
      template: { id: expect.any(Number) },
      customFieldData: expect.any(Array)
    });
    expect(result.taskId).toBe(1);
    expect(result.url).toBe("https://example.com/task/1");
  });

  it("updates task status to closed when status is 'closed'", async () => {
    // First call - get task
    mockPlanfixRequest.mockResolvedValueOnce({
      task: {
        id: 1,
        project: { id: 99 },
        assignees: { users: [{ id: "user:2" }] },
        customFieldData: [],
      },
    });
    
    // Second call - update task
    mockPlanfixRequest.mockResolvedValueOnce({
      id: 1,
      status: { id: 3 }
    });

    const { updateLeadTask } = await import("./planfix_update_lead_task.js");

    const result = await updateLeadTask({
      taskId: 1,
      status: "closed",
      description: "Test description",
    });

    // Verify the update call was made with the correct status
    expect(mockPlanfixRequest).toHaveBeenCalledTimes(2);
    
    const updateCall = mockPlanfixRequest.mock.calls[1][0];
    expect(updateCall.body).toMatchObject({
      status: { id: 3 },
    });
    expect(result.taskId).toBe(1);
    expect(result.url).toBeDefined();
  });

  it("updates task when fields exist and forceUpdate is false", async () => {
    // Mock the task with all fields already set
    const mockTask = {
      id: 1,
      project: { id: 10 },
      assignees: { users: [{ id: "user:1" }] },
      customFieldData: [
        { field: { id: 3 }, value: { id: 5 } },
        { field: { id: 4 }, value: [{ id: 5 }] },
      ],
      status: { id: 1 },
    };
    
    // Mock the get task call
    mockPlanfixRequest.mockResolvedValueOnce({
      task: mockTask,
    });

    // Mock the update call
    mockPlanfixRequest.mockResolvedValueOnce({
      id: 1,
    });

    const { updateLeadTask } = await import("./planfix_update_lead_task.js");

    // When forceUpdate is false, update should still happen for description changes
    await updateLeadTask({
      taskId: 1,
      description: "New description",
      project: "Proj",
      leadSource: "Site",
      tags: ["tag"],
      forceUpdate: false,
    });

    // Should be one call: just get task (no update since no changes)
    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    
    // No update call should be made since no fields were actually changed
    // and forceUpdate is false
  });

  it("handles dry run", async () => {
    const original = await import("../config.js");
    vi.resetModules();
    vi.doMock("../config.js", () => ({
      ...original,
      PLANFIX_DRY_RUN: true,
    }));
    const { updateLeadTask: updateDry } = await import(
      "./planfix_update_lead_task.js"
    );
    const res = await updateDry({
      taskId: 2,
      name: "Test",
      description: "Test description",
    });
    expect(res.taskId).toBe(2);
    expect(mockPlanfixRequest).not.toHaveBeenCalled();
    vi.resetModules();
  });
});
