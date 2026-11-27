// addToLeadTask with the real lead search (searchLeadTask -> searchPlanfixTask)
// over a mocked Planfix API: which lead a request from a returning client goes to.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.PLANFIX_LEAD_TEMPLATE_ID = "42";
});

vi.mock("../config.js", () => ({
  PLANFIX_DRY_RUN: false,
  PLANFIX_TASK_TITLE_TEMPLATE: "Работа с клиентом {name}",
  PLANFIX_FIELD_IDS: { client: 200, leadId: 100 },
}));
vi.mock("../customFieldsConfig.js", () => ({
  customFieldsConfig: { leadTaskFields: [], contactFields: [], userFields: [] },
  webhookConfig: { enabled: false, url: "", token: "", skipPlanfixApi: false },
  proxyUrl: "",
}));
vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn(),
    log: vi.fn(),
    getTaskUrl: (id?: number) => (id ? `https://example.com/task/${id}` : ""),
    getContactUrl: (id?: number) =>
      id ? `https://example.com/contact/${id}` : "",
    getCommentUrl: (taskId: number, commentId: number) =>
      `https://example.com/task/${taskId}?comment=${commentId}`,
  };
});
vi.mock("./planfix_search_contact.js", () => ({
  planfixSearchContact: vi
    .fn()
    .mockResolvedValue({ contactId: 17972, found: true }),
}));
vi.mock("./planfix_update_contact.js", () => ({
  updatePlanfixContact: vi.fn().mockResolvedValue({ contactId: 17972 }),
}));
vi.mock("./planfix_create_lead_task.js", () => ({
  createLeadTask: vi.fn().mockResolvedValue({ taskId: 999 }),
}));
vi.mock("./planfix_create_comment.js", () => ({
  createComment: vi.fn().mockResolvedValue({ commentId: 1 }),
}));
vi.mock("./planfix_update_lead_task.js", () => ({
  updateLeadTask: vi.fn().mockResolvedValue({ taskId: 1 }),
}));

import { planfixRequest } from "../helpers.js";
import { createLeadTask } from "./planfix_create_lead_task.js";
import { createComment } from "./planfix_create_comment.js";
import { addToLeadTask } from "./planfix_add_to_lead_task.js";

const mockRequest = vi.mocked(planfixRequest);
const client = {
  customFieldData: [
    { field: { id: 200 }, value: { id: "contact:17972", name: "Юлия" } },
  ],
};
const TITLE = "Работа с клиентом Юлия Павлова";

/** Planfix returns `leads` for both the client and the title search. */
function leadsInPlanfix(...leads: Array<{ id: number; status: number }>) {
  mockRequest.mockResolvedValue({
    tasks: leads.map(({ id, status }) => ({
      id,
      name: TITLE,
      status: { id: status },
      ...client,
    })),
  });
}

const request = () =>
  addToLeadTask({
    name: "Юлия Павлова",
    telegram: "@Yulia_ShamayevLaw",
    description: "Новая заявка",
  } as never);

describe("addToLeadTask: client whose leads are all closed", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new lead when the last lead is closed as 255 «Не клиент или дубль»", async () => {
    leadsInPlanfix({ id: 854100, status: 3 }, { id: 854209, status: 255 });

    const res = await request();

    expect(createComment).not.toHaveBeenCalled();
    expect(createLeadTask).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 17972, name: TITLE }),
    );
    expect(res.taskId).toBe(999);
  });

  it("comments in the last lead when it is closed with another status", async () => {
    leadsInPlanfix({ id: 854100, status: 255 }, { id: 854209, status: 245 });

    const res = await request();

    expect(createLeadTask).not.toHaveBeenCalled();
    expect(createComment).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 854209 }),
    );
    expect(res.taskId).toBe(854209);
  });

  it("comments in the active lead as before", async () => {
    leadsInPlanfix({ id: 854100, status: 205 }, { id: 854209, status: 255 });

    const res = await request();

    expect(createLeadTask).not.toHaveBeenCalled();
    expect(createComment).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 854100 }),
    );
    expect(res.taskId).toBe(854100);
  });
});
