import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./planfix_search_contact.js", () => ({
  planfixSearchContact: vi.fn(),
}));
vi.mock("./planfix_search_task.js", () => ({
  searchPlanfixTask: vi.fn(),
}));
vi.mock("./planfix_search_company.js", () => ({
  planfixSearchCompany: vi.fn(),
}));

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    getTaskUrl: (id?: number) => (id ? `https://example.com/task/${id}` : ""),
    getContactUrl: (id?: number) =>
      id ? `https://example.com/contact/${id}` : "",
    log: vi.fn(),
  };
});

process.env.PLANFIX_LEAD_TEMPLATE_ID = "42";

import { planfixSearchContact } from "./planfix_search_contact.js";
import { searchPlanfixTask } from "./planfix_search_task.js";
import { planfixSearchCompany } from "./planfix_search_company.js";

const mContact = vi.mocked(planfixSearchContact);
const mTask = vi.mocked(searchPlanfixTask);
const mCompany = vi.mocked(planfixSearchCompany);

afterEach(() => {
  vi.clearAllMocks();
});

describe("searchLeadTask", () => {
  it("returns task and company", async () => {
    mContact.mockResolvedValueOnce({
      contactId: 1,
      firstName: "A",
      lastName: "B",
      found: true,
    } as any);
    mTask.mockResolvedValueOnce({
      taskId: 2,
      assignees: { users: [] },
      found: true,
      totalTasks: 1,
    } as any);
    mCompany.mockResolvedValueOnce({ contactId: 3, found: true } as any);

    const { searchLeadTask } = await import("./planfix_search_lead_task.js");
    const res = await searchLeadTask({ email: "a@b", company: "C" } as any);

    expect(res).toEqual({
      taskId: 2,
      clientId: 1,
      url: "https://example.com/task/2",
      clientUrl: "https://example.com/contact/1",
      assignees: { users: [] },
      firstName: "A",
      lastName: "B",
      agencyId: 3,
      totalTasks: 1,
      found: true,
    });
    expect(mTask).toHaveBeenCalledWith({ clientId: 1, templateId: 42 });
  });

  it("returns not found when contact missing", async () => {
    mContact.mockResolvedValueOnce({ contactId: 0, found: false } as any);
    const { searchLeadTask } = await import("./planfix_search_lead_task.js");
    const res = await searchLeadTask({ email: "x" } as any);
    expect(res.found).toBe(false);
    expect(res.totalTasks).toBe(0);
    expect(mTask).not.toHaveBeenCalled();
  });

  it("treats clientId 0 as not set and searches the contact", async () => {
    mContact.mockResolvedValueOnce({ contactId: 24040, found: true } as any);
    mTask.mockResolvedValueOnce({
      taskId: 931655,
      assignees: { users: [] },
      found: true,
      totalTasks: 2,
    } as any);

    const { searchLeadTask } = await import("./planfix_search_lead_task.js");
    const res = await searchLeadTask({ clientId: 0, name: "Creo" } as any);

    expect(mContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Creo" }),
    );
    expect(mTask).toHaveBeenCalledWith({ clientId: 24040, templateId: 42 });
    expect(res.clientId).toBe(24040);
    expect(res.taskId).toBe(931655);
    expect(res.found).toBe(true);
  });

  it("skips contact search when clientId provided", async () => {
    mTask.mockResolvedValueOnce({
      taskId: 10,
      assignees: { users: [] },
      totalTasks: 2,
    } as any);

    const { searchLeadTask } = await import("./planfix_search_lead_task.js");
    const res = await searchLeadTask({ clientId: 7 } as any);

    expect(res).toEqual({
      taskId: 10,
      clientId: 7,
      url: "https://example.com/task/10",
      clientUrl: "https://example.com/contact/7",
      assignees: { users: [] },
      firstName: undefined,
      lastName: undefined,
      agencyId: undefined,
      totalTasks: 2,
      found: true,
    });
    expect(mContact).not.toHaveBeenCalled();
    expect(mTask).toHaveBeenCalledWith({ clientId: 7, templateId: 42 });
  });

  it("handles errors", async () => {
    mContact.mockRejectedValueOnce(new Error("fail"));
    const { searchLeadTask } = await import("./planfix_search_lead_task.js");
    const res = await searchLeadTask({ email: "x" } as any);
    expect(res.found).toBe(false);
    expect(res.taskId).toBe(0);
    expect(res.totalTasks).toBe(0);
    expect(res.error).toBe("fail");
  });

  it("propagates a failed contact search instead of reporting a clean miss", async () => {
    mContact.mockResolvedValueOnce({
      contactId: 0,
      found: false,
      error: "filter rejected",
    } as any);
    const { searchLeadTask } = await import("./planfix_search_lead_task.js");
    const res = await searchLeadTask({ email: "x" } as any);
    expect(res.clientId).toBe(0);
    expect(res.error).toBe("filter rejected");
  });

  it("propagates a failed lead search instead of reporting no lead", async () => {
    mContact.mockResolvedValueOnce({ contactId: 1, found: true } as any);
    mTask.mockResolvedValueOnce({
      taskId: 0,
      found: false,
      totalTasks: 0,
      error: "Error searching for tasks: timeout",
    } as any);
    const { searchLeadTask } = await import("./planfix_search_lead_task.js");
    const res = await searchLeadTask({ email: "x" } as any);
    expect(res.clientId).toBe(1);
    expect(res.found).toBe(false);
    expect(res.taskSearchError).toBe("Error searching for tasks: timeout");
    expect(res.error).toBe("Error searching for tasks: timeout");
  });

  it("reports no task search error when the lead search cleanly missed", async () => {
    mContact.mockResolvedValueOnce({ contactId: 1, found: true } as any);
    mTask.mockResolvedValueOnce({ taskId: 0, found: false } as any);
    const { searchLeadTask } = await import("./planfix_search_lead_task.js");
    const res = await searchLeadTask({ email: "x" } as any);
    expect(res.taskSearchError).toBeUndefined();
    expect(res.error).toBeUndefined();
  });

  it("reports no error when the contact search cleanly missed", async () => {
    mContact.mockResolvedValueOnce({ contactId: 0, found: false } as any);
    const { searchLeadTask } = await import("./planfix_search_lead_task.js");
    const res = await searchLeadTask({ email: "x" } as any);
    expect(res.error).toBeUndefined();
  });
});

describe("handler", () => {
  it("parses args", async () => {
    mContact.mockResolvedValueOnce({ contactId: 1, found: true } as any);
    mTask.mockResolvedValueOnce({
      taskId: 2,
      assignees: { users: [] },
      found: true,
      totalTasks: 1,
    } as any);
    const { planfixSearchLeadTaskTool } = await import(
      "./planfix_search_lead_task.js"
    );
    const res = (await planfixSearchLeadTaskTool.handler({
      email: "x",
    })) as any;
    expect(res.taskId).toBe(2);
    expect(res.totalTasks).toBe(1);
    expect(mTask).toHaveBeenCalledWith({ clientId: 1, templateId: 42 });
  });

  it("forwards additionalEmails through schema parse to contact search", async () => {
    mContact.mockResolvedValueOnce({ contactId: 1, found: true } as any);
    mTask.mockResolvedValueOnce({
      taskId: 2,
      assignees: { users: [] },
      found: true,
      totalTasks: 1,
    } as any);
    const { planfixSearchLeadTaskTool } = await import(
      "./planfix_search_lead_task.js"
    );
    await planfixSearchLeadTaskTool.handler({
      email: "a@b.com",
      additionalEmails: ["alt@b.com"],
    });
    expect(mContact).toHaveBeenCalledWith(
      expect.objectContaining({ additionalEmails: ["alt@b.com"] }),
    );
  });

  it("parses clientId without contact lookup", async () => {
    mTask.mockResolvedValueOnce({
      taskId: 5,
      assignees: { users: [] },
      totalTasks: 1,
    } as any);
    const { planfixSearchLeadTaskTool } = await import(
      "./planfix_search_lead_task.js"
    );
    const res = (await planfixSearchLeadTaskTool.handler({
      clientId: 9,
    })) as any;
    expect(res.taskId).toBe(5);
    expect(mContact).not.toHaveBeenCalled();
    expect(mTask).toHaveBeenCalledWith({ clientId: 9, templateId: 42 });
  });
});
