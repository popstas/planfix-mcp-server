import { describe, it, expect } from "vitest";
import { PLANFIX_ACCOUNT } from "../config.js";
import { runTool } from "../helpers.js";

describe("planfix_create_task tool prod", () => {
  it("creates task", async () => {
    const args = {
      title: "Сделка 79660620181",
      name: "Контакт 79660620181",
      phone: "79660620181",
      description: "Теги: +7 966 032-88-03, Пропущенный звонок\n\nПоля:\nПереход в &quot;Новый лид&quot;: 1750235798\nАктуальный этап (Основная воронка): Новый лид\nИсточник: Входящий звонок\n\nURL: https://impactcapital.amocrm.ru/leads/detail/36924929"
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
      url: expect.stringMatching(
        new RegExp(
          `^https://${PLANFIX_ACCOUNT.replace(/\./g, "\\.")}\\.planfix\\.com/task/\\d+$`,
        ),
      ),
      clientUrl: expect.stringMatching(
        new RegExp(
          `^https://${PLANFIX_ACCOUNT.replace(/\./g, "\\.")}\\.planfix\\.com/contact/\\d+$`,
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
    expect(content.clientId).toBeGreaterThan(0);
    expect(content.agencyId).toBeGreaterThan(0);
    expect(content.assignees.users.length).toBeGreaterThan(0);
    expect(content.firstName).toBe("Контакт");
    expect(content.lastName).toBe("79660620181");
  });
});
