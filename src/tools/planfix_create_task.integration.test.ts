import { describe, it, expect } from "vitest";
import { PLANFIX_ACCOUNT } from "../config.js";
import { runTool } from "../helpers.js";

describe("planfix_create_task tool prod", () => {
  it("creates task", async () => {
    const args = {
      name: "Stanislav Popov",
      email: "pop.stas@gmail.com",
      phone: "+79222229531",
      agency: "Тестовое агентство",
      object: "Задача",
      leadSource: "Zapier",
      title: "Test task title",
      telegram: "popstas",
      project: "Тестирование интеграции с Планфикс",
    };
    const { valid, content } = await runTool<{
      taskId: number;
      clientId: number;
      url: string;
      clientUrl: string;
      assignees: {
        users: Array<{ id: string; name: string }>;
        groups: any[];
      };
      firstName: string;
      lastName: string;
      agencyId: number;
    }>("planfix_create_task", args);
    expect(valid).toBe(true);

    // Check response structure and types
    expect(content).toMatchObject({
      taskId: expect.any(Number),
      clientId: expect.any(Number),
      url: expect.stringMatching(new RegExp(`^https://${PLANFIX_ACCOUNT.replace(/\./g, '\\.')}\\.planfix\\.com/task/\\d+$`)),
      clientUrl: expect.stringMatching(new RegExp(`^https://${PLANFIX_ACCOUNT.replace(/\./g, '\\.')}\\.planfix\\.com/contact/\\d+$`)),
      assignees: {
        users: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(/^user:\d+$/),
            name: expect.any(String)
          })
        ]),
        groups: expect.any(Array)
      },
      firstName: expect.any(String),
      lastName: expect.any(String),
      agencyId: expect.any(Number)
    });

    // Additional specific checks
    expect(content.taskId).toBeGreaterThan(0);
    expect(content.clientId).toBeGreaterThan(0);
    expect(content.agencyId).toBeGreaterThan(0);
    expect(content.assignees.users.length).toBeGreaterThan(0);
    expect(content.firstName).toBe('Stanislav');
    expect(content.lastName).toBe('Popov');
  });
});
