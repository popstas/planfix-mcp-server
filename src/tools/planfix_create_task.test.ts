import { describe, it, expect, vi } from "vitest";

vi.mock("./planfix_add_to_lead_task.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./planfix_add_to_lead_task.js")>();
  return {
    ...actual,
    addToLeadTask: vi.fn().mockResolvedValue({ taskId: 3, clientId: 2 }),
  };
});

import { planfixCreateTask } from "./planfix_create_task.js";
import { addToLeadTask } from "./planfix_add_to_lead_task.js";

const mockAdd = vi.mocked(addToLeadTask);

describe("planfix_create_task", () => {
  it("forwards data to addToLeadTask", async () => {
    const args = {
      title: "New lead",
      name: "John Smith",
      phone: "+123",
      agency: "Agency",
      referral: "Ref",
      leadSource: "site",
    };

    const res = await planfixCreateTask(args);

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        name: args.name,
        phone: args.phone,
        header: args.title,
      }),
    );
    expect(res.taskId).toBe(3);
  });
});
