import { describe, it, expect } from "vitest";
import { PLANFIX_ACCOUNT } from "../config.js";
import { runTool } from "../helpers.js";

describe("planfix_create_task tool prod", () => {
  it("creates task", async () => {
    const args = {
      title: "Сделка 79688854424",
      name: "Дмитрий",
      phone: "79222222223",
      leadSource: "Входящий звонок",
      tags: ["Пропущенный звонок", "79222222223"],
      description:
        "\nТеги:\nПропущенный звонок, 79222222223\n\nПоля:\nПереход в &quot;Новый лид&quot;: 1750162698\nroistat: Sipuni\nАктуальный этап (Основная воронка): Отказ\nИсточник: Входящий звонок\nПричина отказа: Черный список / не целевой\nКвалификация: Нецелевой\nПереход в &quot;Отказ&quot;: 1750164638\n\nURL: https://example.ru/leads/detail/36920019",
      managerEmail: "popstas@gmail.com",
      pipeline: "Основная воронка",
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
          `^https://${PLANFIX_ACCOUNT.replace(/\./g, "\\.")}\\.planfix\\.com/task/\\d+$`
        )
      ),
      clientUrl: expect.stringMatching(
        new RegExp(
          `^https://${PLANFIX_ACCOUNT.replace(/\./g, "\\.")}\\.planfix\\.com/contact/\\d+$`
        )
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
