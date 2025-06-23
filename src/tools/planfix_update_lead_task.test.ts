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

  it("updates lead task fields", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({});
    const { updateLeadTask } = await import("./planfix_update_lead_task.js");

    const result = await updateLeadTask({
      taskId: 1,
      name: "New",
      description: "Desc",
      managerEmail: "manager@example.com",
      project: "Proj",
      leadSource: "Site",
      tags: ["tag"],
    });

    expect(mockPlanfixRequest).toHaveBeenCalledWith({
      path: "task/1",
      body: expect.any(Object),
    });
    expect(result.taskId).toBe(1);
    expect(result.url).toBe("https://example.com/task/1");
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
      description: "Test description" 
    });
    expect(res.taskId).toBe(2);
    expect(mockPlanfixRequest).not.toHaveBeenCalled();
    vi.resetModules();
  });
});
