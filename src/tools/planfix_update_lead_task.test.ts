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

    const calls = mockPlanfixRequest.mock.calls.map((c) => c[0]);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "task/1",
          body: { fields: "id,name,description,1,2,3,4" },
          method: "GET",
        }),
        expect.objectContaining({ path: "task/1" }),
      ]),
    );
    expect(result.taskId).toBe(1);
    expect(result.url).toBe("https://example.com/task/1");
  });

  it("skips update when fields exist and forceUpdate is false", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      task: {
        id: 1,
        project: { id: 10 },
        assignees: { users: [{ id: "user:1" }] },
        customFieldData: [
          { field: { id: 3 }, value: { id: 5 } },
          { field: { id: 4 }, value: [{ id: 5 }] },
        ],
      },
    });

    const { updateLeadTask } = await import("./planfix_update_lead_task.js");

    const result = await updateLeadTask({
      taskId: 1,
      description: "Desc",
      managerEmail: "manager@example.com",
      project: "Proj",
      leadSource: "Site",
      tags: ["tag"],
    });

    const calls = mockPlanfixRequest.mock.calls.map((c) => c[0]);
    expect(calls.filter((c) => c.path === "task/1").length).toBe(1);
    expect(result.taskId).toBe(1);
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
