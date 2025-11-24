import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn(),
    getTaskUrl: (id: number) => `https://example.com/task/${id}`,
    log: vi.fn(),
  };
});

import { planfixRequest, log } from "../helpers.js";

import planfixGetChildTasksTool, {
  getChildTasks,
} from "./planfix_get_child_tasks.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);
const mockLog = vi.mocked(log);

describe("getChildTasks", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and maps child tasks", async () => {
    mockPlanfixRequest.mockResolvedValueOnce({
      tasks: [
        {
          id: 1,
          name: "Child task",
          description: "desc",
          status: { id: 2, name: "open", isActive: true },
          assignees: [{ id: 3, name: "Assignee", isActive: true }],
        },
      ],
      pagination: { count: 1, pageNumber: 1, pageSize: 100 },
    });

    const result = await getChildTasks({ parentTaskId: 42 });

    expect(mockPlanfixRequest).toHaveBeenCalledWith({
      path: "task/list",
      body: expect.objectContaining({
        parent: { id: 42 },
        pageSize: 100,
        offset: 0,
      }),
    });

    expect(result).toEqual({
      tasks: [
        {
          id: 1,
          name: "Child task",
          url: "https://example.com/task/1",
          description: "desc",
          assignees: [{ id: 3, name: "Assignee", isActive: true }],
          status: "open",
          parent_task_id: 42,
        },
      ],
      totalCount: 1,
    });
  });

  it("recursively fetches and flattens all subtasks", async () => {
    mockPlanfixRequest
      .mockResolvedValueOnce({
        tasks: [
          {
            id: 1,
            name: "Child task",
            status: { id: 2, name: "open", isActive: true },
            assignees: [],
          },
        ],
        pagination: { count: 1, pageNumber: 1, pageSize: 100 },
      })
      .mockResolvedValueOnce({
        tasks: [
          {
            id: 2,
            name: "Grandchild task",
            status: { id: 2, name: "open", isActive: true },
            assignees: [],
          },
        ],
        pagination: { count: 1, pageNumber: 1, pageSize: 100 },
      })
      .mockResolvedValueOnce({
        tasks: [],
        pagination: { count: 0, pageNumber: 1, pageSize: 100 },
      });

    const result = await getChildTasks({ parentTaskId: 42, recursive: true });

    expect(mockPlanfixRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        body: expect.objectContaining({ parent: { id: 42 } }),
      }),
    );
    expect(mockPlanfixRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: expect.objectContaining({ parent: { id: 1 } }),
      }),
    );
    expect(mockPlanfixRequest).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        body: expect.objectContaining({ parent: { id: 2 } }),
      }),
    );

    expect(result).toEqual({
      tasks: [
        {
          id: 1,
          name: "Child task",
          url: "https://example.com/task/1",
          description: undefined,
          assignees: [],
          status: "open",
          parent_task_id: 42,
        },
        {
          id: 2,
          name: "Grandchild task",
          url: "https://example.com/task/2",
          description: undefined,
          assignees: [],
          status: "open",
          parent_task_id: 1,
        },
      ],
      totalCount: 2,
    });
  });

  it("returns empty result on error", async () => {
    mockPlanfixRequest.mockRejectedValueOnce(new Error("fail"));

    const result = await getChildTasks({ parentTaskId: 42 });

    expect(mockPlanfixRequest).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalled();
    expect(result).toEqual({
      tasks: [],
      totalCount: 0,
      error: "fail",
    });
  });
});

describe("planfixGetChildTasksTool handler", () => {
  it("validates input", async () => {
    await expect(
      planfixGetChildTasksTool.handler({ parentTaskId: "1" } as any),
    ).rejects.toThrow();
  });
});
