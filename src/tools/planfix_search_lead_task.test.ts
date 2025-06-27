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

import { planfixSearchContact } from "./planfix_search_contact.js";
import { searchPlanfixTask } from "./planfix_search_task.js";
import { planfixSearchCompany } from "./planfix_search_company.js";
import {
  searchLeadTask,
  planfixSearchLeadTaskTool,
} from "./planfix_search_lead_task.js";

const mContact = vi.mocked(planfixSearchContact);
const mTask = vi.mocked(searchPlanfixTask);
const mCompany = vi.mocked(planfixSearchCompany);

describe("searchLeadTask", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

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
    } as any);
    mCompany.mockResolvedValueOnce({ contactId: 3, found: true } as any);

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
      found: true,
    });
    expect(mTask).toHaveBeenCalledWith({ clientId: 1 });
  });

  it("returns not found when contact missing", async () => {
    mContact.mockResolvedValueOnce({ contactId: 0, found: false } as any);
    const res = await searchLeadTask({ email: "x" } as any);
    expect(res.found).toBe(false);
    expect(mTask).not.toHaveBeenCalled();
  });

  it("handles errors", async () => {
    mContact.mockRejectedValueOnce(new Error("fail"));
    const res = await searchLeadTask({ email: "x" } as any);
    expect(res.found).toBe(false);
    expect(res.taskId).toBe(0);
  });
});

describe("handler", () => {
  it("parses args", async () => {
    mContact.mockResolvedValueOnce({ contactId: 1, found: true } as any);
    mTask.mockResolvedValueOnce({
      taskId: 2,
      assignees: { users: [] },
      found: true,
    } as any);
    const res = (await planfixSearchLeadTaskTool.handler({
      email: "x",
    })) as any;
    expect(res.taskId).toBe(2);
  });
});
