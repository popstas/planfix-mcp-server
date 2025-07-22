import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../config.js", () => ({
  PLANFIX_DRY_RUN: false,
  PLANFIX_FIELD_IDS: {
    client: 1,
    manager: 2,
    agency: 3,
    leadSource: 4,
    pipeline: 5,
    tags: 6,
  },
}));

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn().mockResolvedValue({ id: 1 }),
    getTaskUrl: (id: number) => `https://example.com/task/${id}`,
  };
});

vi.mock("./planfix_search_project.js", () => ({
  searchProject: vi.fn().mockResolvedValue({ projectId: 10, found: true }),
}));

vi.mock("../lib/planfixObjects.js", () => ({
  getFieldDirectoryId: vi.fn().mockResolvedValue(100),
}));

vi.mock("../lib/planfixDirectory.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/planfixDirectory.js")>();
  return {
    ...actual,
    addDirectoryEntry: vi.fn(async ({ fieldId, postBody }) => {
      if (!postBody.customFieldData) postBody.customFieldData = [];
      postBody.customFieldData.push({ field: { id: fieldId }, value: { id: 5 } });
      return 5;
    }),
    addDirectoryEntries: vi.fn(async ({ fieldId, postBody }) => {
      if (!postBody.customFieldData) postBody.customFieldData = [];
      postBody.customFieldData.push({ field: { id: fieldId }, value: [{ id: 5 }] });
      return [5];
    }),
  };
});

vi.mock("../lib/planfixCustomFields.js", () => ({
  getTaskCustomFieldName: vi.fn().mockResolvedValue("Field name"),
}));

import { planfixRequest } from "../helpers.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);

describe("planfix_create_lead_task", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates task with pipeline", async () => {
    const { createLeadTask } = await import("./planfix_create_lead_task.js");

    const result = await createLeadTask({
      name: "Test",
      description: "Desc",
      clientId: 1,
      managerId: 2,
      agencyId: 3,
      project: "Proj",
      leadSource: "Site",
      pipeline: "Main",
      tags: ["tag"],
    });

    expect(mockPlanfixRequest).toHaveBeenCalledWith({
      path: "task/",
      body: expect.objectContaining({
        customFieldData: expect.arrayContaining([
          expect.objectContaining({
            field: { id: 5 },
            value: { id: 5 },
          }),
        ]),
      }),
    });
    expect(result.taskId).toBe(1);
  });

  it("adds field name to error message when custom field required", async () => {
    mockPlanfixRequest.mockRejectedValueOnce(
      new Error("custom_field_is_required, id 81905"),
    );
    const { getTaskCustomFieldName } = await import(
      "../lib/planfixCustomFields.js"
    );
    const mockGetName = vi.mocked(getTaskCustomFieldName);
    mockGetName.mockResolvedValueOnce("Источник лида");

    const { createLeadTask } = await import("./planfix_create_lead_task.js");
    const result = await createLeadTask({
      name: "Test",
      description: "Desc",
      clientId: 1,
    });

    expect(result.error).toContain("name: Источник лида");
  });
});
