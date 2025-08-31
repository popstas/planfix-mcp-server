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
  const actual =
    await importOriginal<typeof import("../lib/planfixDirectory.js")>();
  return {
    ...actual,
    addDirectoryEntry: vi.fn(async ({ fieldId, postBody }) => {
      if (!postBody.customFieldData) postBody.customFieldData = [];
      postBody.customFieldData.push({
        field: { id: fieldId },
        value: { id: 5 },
      });
      return 5;
    }),
    addDirectoryEntries: vi.fn(async ({ fieldId, postBody }) => {
      if (!postBody.customFieldData) postBody.customFieldData = [];
      postBody.customFieldData.push({
        field: { id: fieldId },
        value: [{ id: 5 }],
      });
      return [5];
    }),
  };
});

vi.mock("../lib/planfixCustomFields.js", () => ({
  getTaskCustomFieldName: vi.fn().mockResolvedValue("Field name"),
}));

vi.mock("../customFieldsConfig.js", () => {
  const chatApiConfig = {
    chatApiToken: "",
    providerId: "",
    useChatApi: false,
    baseUrl: "",
  };
  return {
    customFieldsConfig: { leadTaskFields: [], contactFields: [] },
    chatApiConfig,
  };
});

vi.mock("../chatApi.js", () => ({
  chatApiRequest: vi.fn(),
  getChatId: (args: { clientId?: number; phone?: string; email?: string; telegram?: string }) =>
    (typeof args?.clientId === "number" ? `chat${args.clientId}` : args?.phone || args?.email || args?.telegram || "chat_test"),
}));

vi.mock("./planfix_update_lead_task.js", () => ({
  updateLeadTask: vi.fn().mockResolvedValue({ taskId: 1 }),
}));

vi.mock("./planfix_update_contact.js", () => ({
  updatePlanfixContact: vi.fn().mockResolvedValue({ contactId: 2 }),
}));

import { planfixRequest } from "../helpers.js";
import { chatApiRequest } from "../chatApi.js";
import { updateLeadTask } from "./planfix_update_lead_task.js";
import { updatePlanfixContact } from "./planfix_update_contact.js";
import { chatApiConfig } from "../customFieldsConfig.js";

const mockPlanfixRequest = vi.mocked(planfixRequest);
const mockChatApiRequest = vi.mocked(chatApiRequest);
const mockUpdateLeadTask = vi.mocked(updateLeadTask);
const mockUpdatePlanfixContact = vi.mocked(updatePlanfixContact);

describe("planfix_create_lead_task", () => {
  afterEach(() => {
    vi.clearAllMocks();
    chatApiConfig.useChatApi = false;
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

  it("creates task via chat API when enabled", async () => {
    mockChatApiRequest
      .mockResolvedValueOnce({ chatId: 11, contactId: 22 })
      .mockResolvedValueOnce({ data: { number: 33 } });
    chatApiConfig.useChatApi = true;
    const { createLeadTask } = await import("./planfix_create_lead_task.js");
    const result = await createLeadTask({
      description: "Hi",
      clientId: 1,
      message: "hello",
      contactName: "User",
      email: "a@b.c",
    });
    expect(mockChatApiRequest).toHaveBeenNthCalledWith(
      1,
      "newMessage",
      expect.objectContaining({
        chatId: "chat1",
        contactId: 1,
        message: "Hi",
      }),
    );
    expect(mockChatApiRequest).toHaveBeenNthCalledWith(2, "getTask", {
      chatId: "chat1",
    });
    expect(mockUpdateLeadTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 33 }),
    );
    expect(mockUpdateLeadTask).toHaveBeenCalledTimes(1);
    expect(mockUpdatePlanfixContact).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 1, email: "a@b.c" }),
    );
    expect(mockUpdatePlanfixContact).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ taskId: 33, url: "https://example.com/task/33" });
    expect(mockPlanfixRequest).not.toHaveBeenCalled();
  });
});
