import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("./planfix_create_sell_task_ids.js", () => ({
  createSellTaskIds: vi.fn().mockResolvedValue({ taskId: 321, url: "url" }),
  CreateSellTaskOutputSchema: z.object({
    taskId: z.number(),
    url: z.string(),
  }),
}));

vi.mock("./planfix_search_lead_task.js", () => ({
  searchLeadTask: vi.fn(),
}));

vi.mock("./planfix_search_company.js", () => ({
  planfixSearchCompany: vi.fn(),
}));

import { createSellTask } from "./planfix_create_sell_task.js";
import { createSellTaskIds } from "./planfix_create_sell_task_ids.js";
import { searchLeadTask } from "./planfix_search_lead_task.js";
import { planfixSearchCompany } from "./planfix_search_company.js";

const mockCreateSellTaskIds = vi.mocked(createSellTaskIds);
const mockSearchLeadTask = vi.mocked(searchLeadTask);
const mockSearchCompany = vi.mocked(planfixSearchCompany);

describe("createSellTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves identifiers and calls createSellTaskIds", async () => {
    mockSearchLeadTask.mockResolvedValue({
      clientId: 42,
      taskId: 77,
      agencyId: 99,
      assignees: { users: [{ id: "user:5" }, { id: "user:8" }] },
    } as any);

    const result = await createSellTask({
      name: "Продажа товара",
      agency: "Жууу",
      email: "agency@example.com",
      employeeName: "Имя Сотрудника",
      telegram: "agency_telegram",
      description: "список товаров",
    });

    expect(mockCreateSellTaskIds).toHaveBeenCalledWith({
      clientId: 42,
      leadTaskId: 77,
      agencyId: 99,
      assignees: [5, 8],
      name: "Продажа товара",
      description: "список товаров",
      project: undefined,
    });
    expect(result).toEqual({ taskId: 321, url: "url" });
    expect(mockSearchCompany).not.toHaveBeenCalled();
  });

  it("fetches agency id when not provided by search", async () => {
    mockSearchLeadTask.mockResolvedValue({
      clientId: 10,
      taskId: 0,
      assignees: { users: [] },
    } as any);
    mockSearchCompany.mockResolvedValue({ contactId: 555 });

    await createSellTask({
      name: "Продажа",
      agency: "Новая",
      email: "email@example.com",
      contactName: "Имя",
      description: "описание",
      project: "Proj",
    });

    expect(mockSearchCompany).toHaveBeenCalledWith({ name: "Новая" });
    expect(mockCreateSellTaskIds).toHaveBeenCalledWith({
      clientId: 10,
      leadTaskId: undefined,
      agencyId: 555,
      assignees: undefined,
      name: "Продажа",
      description: "описание",
      project: "Proj",
    });
  });

  it("throws when contact cannot be resolved", async () => {
    mockSearchLeadTask.mockResolvedValue({
      clientId: 0,
      taskId: 0,
    } as any);

    await expect(
      createSellTask({
        name: "Продажа",
        email: "missing@example.com",
        description: "описание",
      }),
    ).rejects.toThrow(
      "Unable to find a Planfix contact for the provided email/telegram",
    );
    expect(mockCreateSellTaskIds).not.toHaveBeenCalled();
  });
});
