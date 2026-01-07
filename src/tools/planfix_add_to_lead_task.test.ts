import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./planfix_search_lead_task.js", () => ({
  searchLeadTask: vi.fn().mockResolvedValue({
    taskId: 0,
    clientId: 2,
    url: "",
    clientUrl: "",
    assignees: { users: [] },
    firstName: "",
    lastName: "",
    agencyId: undefined,
    found: true,
  }),
}));

vi.mock("./planfix_create_contact.js", () => ({
  createPlanfixContact: vi.fn(),
}));

vi.mock("./planfix_update_contact.js", () => ({
  updatePlanfixContact: vi.fn().mockResolvedValue({ contactId: 2 }),
}));

vi.mock("./planfix_search_task.js", () => ({
  searchPlanfixTask: vi
    .fn()
    .mockResolvedValue({ taskId: 0, assignees: { users: [] } }),
}));

vi.mock("./planfix_create_lead_task.js", () => ({
  createLeadTask: vi.fn().mockResolvedValue({ taskId: 3 }),
}));

vi.mock("./planfix_create_comment.js", () => ({
  createComment: vi.fn(),
}));

vi.mock("./planfix_search_manager.js", () => ({
  searchManager: vi.fn().mockResolvedValue({ managerId: null }),
}));

vi.mock("../customFieldsConfig.js", () => ({
  customFieldsConfig: { leadTaskFields: [], contactFields: [] },
  webhookConfig: {
    enabled: false,
    url: "",
    token: "",
    skipPlanfixApi: false,
  },
  proxyUrl: "",
}));

import { updatePlanfixContact } from "./planfix_update_contact.js";
import { createLeadTask } from "./planfix_create_lead_task.js";
import { addToLeadTask } from "./planfix_add_to_lead_task.js";
import { webhookConfig } from "../customFieldsConfig.js";

const mockUpdate = vi.mocked(updatePlanfixContact);
const mockCreateLeadTask = vi.mocked(createLeadTask);

describe("planfix_add_to_lead_task", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    webhookConfig.enabled = false;
    webhookConfig.url = "";
    webhookConfig.token = "";
    webhookConfig.skipPlanfixApi = false;
  });

  it("calls updatePlanfixContact when contact exists", async () => {
    const args = { name: "John Doe", description: "Test" };
    const res = await addToLeadTask(args as any);
    expect(res.clientId).toBe(2);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 2 }),
    );
  });

  it("uses template from config when title is missing", async () => {
    const original = await import("../config.js");
    vi.resetModules();
    vi.doMock("../config.js", () => ({
      ...original,
      PLANFIX_TASK_TITLE_TEMPLATE: "Lead {email}",
    }));
    const { addToLeadTask: addWithTemplate } = await import(
      "./planfix_add_to_lead_task.js"
    );

    await addWithTemplate({
      email: "test@example.com",
      description: "d",
    } as any);
    expect(mockCreateLeadTask).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Lead test@example.com" }),
    );
    vi.resetModules();
  });

  it("sends webhook payload before creating lead task", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ taskId: 999 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    webhookConfig.enabled = true;
    webhookConfig.url = "https://example.com/hook";
    webhookConfig.token = "secret";

    await addToLeadTask({
      name: "John Doe",
      description: "Test",
      email: "john@example.com",
    } as any);

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/hook", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "John Doe",
        description: "Test",
        email: "john@example.com",
        api_key: "secret",
        Description: "Test",
        UserName: "John Doe",
      }),
    });
    expect(mockCreateLeadTask).toHaveBeenCalled();
  });

  it("skips planfix API when webhook skipPlanfixApi is enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ taskId: 321 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    webhookConfig.enabled = true;
    webhookConfig.url = "https://example.com/hook";
    webhookConfig.token = "secret";
    webhookConfig.skipPlanfixApi = true;

    const result = await addToLeadTask({
      name: "John Doe",
      description: "Test",
    } as any);

    expect(result).toEqual({ taskId: 321, clientId: 2 });
    expect(mockCreateLeadTask).not.toHaveBeenCalled();
  });
});
