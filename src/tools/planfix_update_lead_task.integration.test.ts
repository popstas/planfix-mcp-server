import { describe, it, expect } from "vitest";
import { PLANFIX_ACCOUNT } from "../config.js";
import { runTool } from "../helpers.js";

describe("planfix_update_lead_task tool prod", () => {
  it("updates task", async () => {
    const args = {
      taskId: 5704,
      description: "",
      title: "Сделка 79688854424 upd",
      name: "Контакт 79660620181",
      phone: "79222222222",
      leadSource: "Входящий звонок",
      pipeline: "Основная воронка",
      tags: ["+7 966 032-88-03", "Пропущенный звонок"],
      forceUpdate: true,
    };
    const { valid, content } = await runTool<{
      taskId: number;
      url: string;
      assignees: {
        users: Array<{ id: string; name: string }>;
        groups: any[];
      };
      firstName: string;
      lastName: string;
      agencyId: number;
    }>("planfix_update_lead_task", args);
    expect(valid).toBe(true);

    // Check response structure and types
    expect(content).toMatchObject({
      taskId: expect.any(Number),
      url: expect.stringMatching(
        new RegExp(
          `^https://${PLANFIX_ACCOUNT.replace(/\./g, "\\.")}\\.planfix\\.com/task/\\d+$`,
        ),
      ),
      assignees: {
        users: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(/^user:\d+$/),
            name: expect.any(String),
          }),
        ]),
        groups: expect.any(Array),
      },
      firstName: expect.any(String),
      lastName: expect.any(String),
      agencyId: expect.any(Number),
    });

    // Additional specific checks
    expect(content.taskId).toBeGreaterThan(0);
    expect(content.agencyId).toBeGreaterThan(0);
    expect(content.assignees.users.length).toBeGreaterThan(0);
    expect(content.firstName).toBe("Контакт");
    expect(content.lastName).toBe("79660620181");
  });
});
