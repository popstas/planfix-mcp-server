import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("../config.js", () => ({
  PLANFIX_DRY_RUN: false,
  PLANFIX_FIELD_IDS: { tags: 10 },
}));

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

vi.mock("../helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../helpers.js")>();
  return {
    ...actual,
    planfixRequest: vi.fn(),
  };
});

vi.mock("../lib/planfixDirectory.js", () => ({
  searchDirectoryEntryById: vi.fn(),
  getDirectoryFields: vi.fn(),
  createDirectoryEntry: vi.fn(),
}));

vi.mock("../lib/planfixObjects.js", () => ({
  getFieldDirectoryId: vi.fn().mockResolvedValue(20),
}));

import { updatePlanfixContact } from "./planfix_update_contact.js";
import { addToLeadTask } from "./planfix_add_to_lead_task.js";
import { planfixRequest } from "../helpers.js";
import {
  searchDirectoryEntryById,
  createDirectoryEntry,
  getDirectoryFields,
} from "../lib/planfixDirectory.js";

const mockUpdate = vi.mocked(updatePlanfixContact);
const mockPlanfixRequest = vi.mocked(planfixRequest);
const mockSearchEntry = vi.mocked(searchDirectoryEntryById);
const mockCreateEntry = vi.mocked(createDirectoryEntry);
const mockGetDirectoryFields = vi.mocked(getDirectoryFields);

describe("planfix_add_to_lead_task", () => {
  beforeEach(() => {
    mockPlanfixRequest.mockResolvedValue({ id: 3 });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls updatePlanfixContact when contact exists", async () => {
    const args = { name: "John Doe", description: "Test" };
    await addToLeadTask(args as any);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 2 }),
    );
  });

  it("creates directory entry when tag id not found", async () => {
    process.env.PLANFIX_LEAD_TEMPLATE_ID = "1";
    mockGetDirectoryFields.mockResolvedValueOnce([
      { id: 30, name: "name", type: 1 },
    ]);
    mockSearchEntry.mockResolvedValueOnce(undefined);
    mockCreateEntry.mockResolvedValueOnce(55);

    await addToLeadTask({
      name: "John Doe",
      description: "Test",
      tags: ["new"],
    } as any);

    expect(mockCreateEntry).toHaveBeenCalledWith(20, 30, "new");
    expect(mockPlanfixRequest).toHaveBeenCalledWith(
      expect.objectContaining({ path: "task/3" }),
    );
  });
});
