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
