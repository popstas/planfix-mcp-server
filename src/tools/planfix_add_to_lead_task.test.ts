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
import { createPlanfixContact } from "./planfix_create_contact.js";
import { searchLeadTask } from "./planfix_search_lead_task.js";
import { createLeadTask } from "./planfix_create_lead_task.js";
import { addToLeadTask } from "./planfix_add_to_lead_task.js";
import { webhookConfig } from "../customFieldsConfig.js";

const mockUpdate = vi.mocked(updatePlanfixContact);
const mockCreate = vi.mocked(createPlanfixContact);
const mockSearch = vi.mocked(searchLeadTask);
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

  it("threads additionalEmails into search and update", async () => {
    const args = {
      name: "John Doe",
      description: "Test",
      email: "john@example.com",
      additionalEmails: ["alt@example.com"],
    };
    await addToLeadTask(args as any);
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ additionalEmails: ["alt@example.com"] }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 2,
        additionalEmails: ["alt@example.com"],
      }),
    );
  });

  it("does not create a contact when the search failed rather than missed, but still captures the lead", async () => {
    mockSearch.mockResolvedValueOnce({
      taskId: 0,
      clientId: 0,
      url: "",
      clientUrl: "",
      assignees: { users: [] },
      firstName: "",
      lastName: "",
      agencyId: undefined,
      totalTasks: 0,
      error: "filter 4221 rejected",
      found: false,
    });

    const res = await addToLeadTask({
      name: "Jane Roe",
      description: "Test",
      email: "jane@example.com",
    } as any);

    expect(mockCreate).not.toHaveBeenCalled();
    // A rejected filter must not cost the lead itself: the task is still
    // created, unlinked, with the search error surfaced to the caller.
    expect(mockCreateLeadTask).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 0 }),
    );
    expect(res.clientId).toBe(0);
    expect(res.error).toContain("filter 4221 rejected");
  });

  it("threads additionalEmails into createPlanfixContact when contact is missing", async () => {
    mockSearch.mockResolvedValueOnce({
      taskId: 0,
      clientId: 0,
      url: "",
      clientUrl: "",
      assignees: { users: [] },
      firstName: "",
      lastName: "",
      agencyId: undefined,
      totalTasks: 0,
      found: false,
    });
    mockCreate.mockResolvedValueOnce({ contactId: 7 });

    await addToLeadTask({
      name: "Jane Roe",
      description: "Test",
      email: "jane@example.com",
      additionalEmails: ["second@example.com"],
    } as any);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ additionalEmails: ["second@example.com"] }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("omitting additionalEmails leaves it undefined on update", async () => {
    await addToLeadTask({ name: "John Doe", description: "Test" } as any);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ additionalEmails: undefined }),
    );
  });

  it("surfaces updatePlanfixContact errors in the result", async () => {
    mockUpdate.mockResolvedValueOnce({
      contactId: 0,
      error: "Field 124 is read-only",
    });

    const res = await addToLeadTask({
      name: "John Doe",
      description: "Test",
      additionalEmails: ["alt@example.com"],
    } as any);

    expect(res.error).toBe("Field 124 is read-only");
    expect(res.clientId).toBe(2);
  });

  it("keeps contact update errors when the lead task creation also fails", async () => {
    mockUpdate.mockResolvedValueOnce({
      contactId: 0,
      error: "Field 124 is read-only",
    });
    mockCreateLeadTask.mockResolvedValueOnce({
      taskId: 0,
      error: "task create failed",
    });

    const res = await addToLeadTask({
      name: "John Doe",
      description: "Test",
      additionalEmails: ["alt@example.com"],
    } as any);

    expect(res.error).toBe("Field 124 is read-only\ntask create failed");
  });

  it("keeps contact update errors when the planfix API is skipped", async () => {
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
    mockUpdate.mockResolvedValueOnce({
      contactId: 0,
      error: "Field 124 is read-only",
    });

    const res = await addToLeadTask({
      name: "John Doe",
      description: "Test",
    } as any);

    expect(res.error).toBe("Field 124 is read-only");
  });

  it("returns no error when the contact update succeeds", async () => {
    const res = await addToLeadTask({
      name: "John Doe",
      description: "Test",
    } as any);
    expect(res.error).toBeUndefined();
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
        api_key: "secret",
      },
      body: JSON.stringify({
        name: "John Doe",
        description: "Test",
        email: "john@example.com",
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
