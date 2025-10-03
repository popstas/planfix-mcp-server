import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../config.js", () => ({
  PLANFIX_DRY_RUN: false,
  PLANFIX_FIELD_IDS: {
    client: 1,
    agency: 2,
    leadSource: 3,
    serviceMatrix: 4,
  },
}));

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn().mockResolvedValue({ id: 123 }),
    getTaskUrl: (id: number) => `https://example.com/task/${id}`,
    log: vi.fn(),
  };
});

vi.mock("./planfix_search_project.js", () => ({
  searchProject: vi.fn().mockResolvedValue({ projectId: 10, found: true }),
}));

vi.mock("../lib/extendPostBodyWithCustomFields.js", () => ({
  extendPostBodyWithCustomFields: vi.fn(),
}));

import { planfixRequest } from "../helpers.js";
import { searchProject } from "./planfix_search_project.js";
import { createSellTaskIds } from "./planfix_create_sell_task_ids.js";

const mockRequest = vi.mocked(planfixRequest);
const mockSearchProject = vi.mocked(searchProject);

describe("createSellTaskIds", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends request with found project", async () => {
    process.env.PLANFIX_SELL_TEMPLATE_ID = "11";
    process.env.PLANFIX_FIELD_ID_LEAD_SOURCE_VALUE = "9";
    process.env.PLANFIX_FIELD_ID_SERVICE_MATRIX_VALUE = "8";

    const result = await createSellTaskIds({
      clientId: 1,
      leadTaskId: 2,
      agencyId: 3,
      assignees: [5],
      name: "Name",
      description: "Line1\nLine2",
      project: "Proj",
    });

    expect(mockSearchProject).toHaveBeenCalledWith({ name: "Proj" });
    const call = mockRequest.mock.calls[0][0];
    const body = call.body as any;
    expect(body.project).toEqual({ id: 10 });
    expect(body.assignees.users[0].id).toBe("user:5");
    expect(body.description).toContain("Line1<br>Line2");
    expect(body.customFieldData).toEqual(
      expect.arrayContaining([
        { field: { id: 1 }, value: { id: 1 } },
        { field: { id: 2 }, value: { id: 3 } },
        { field: { id: 3 }, value: { id: 9 } },
        { field: { id: 4 }, value: { id: 8 } },
      ]),
    );
    expect(result.taskId).toBe(123);
    expect(result.url).toBe("https://example.com/task/123");
  });

  it("adds project name to description when not found", async () => {
    mockSearchProject.mockResolvedValueOnce({ found: false, projectId: 0 });

    await createSellTaskIds({
      clientId: 1,
      leadTaskId: 2,
      name: "N",
      description: "Desc",
      project: "Missing",
    });

    const body = mockRequest.mock.calls[0][0].body as any;
    expect(body.description).toContain("Проект: Missing");
  });

  it("omits parent when leadTaskId is not provided", async () => {
    process.env.PLANFIX_SELL_TEMPLATE_ID = "11";

    await createSellTaskIds({
      clientId: 1,
      name: "Name",
      description: "Desc",
    });

    const body = mockRequest.mock.calls[0][0].body as any;
    expect(body.parent).toBeUndefined();
  });

  it("handles dry run", async () => {
    const original = await import("../config.js");
    vi.resetModules();
    vi.doMock("../config.js", () => ({
      ...original,
      PLANFIX_DRY_RUN: true,
    }));
    const { createSellTaskIds: createDry } = await import(
      "./planfix_create_sell_task_ids.js"
    );
    const res = await createDry({
      clientId: 1,
      name: "",
      description: "",
    });
    expect(res.taskId).toBeGreaterThan(0);
    vi.resetModules();
  });
});
