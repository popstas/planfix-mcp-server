import { describe, it, expect } from "vitest";
import { PLANFIX_ACCOUNT } from "../config.js";
import { runTool } from "../helpers.js";

describe("planfix_create_task tool prod", () => {
  it("creates task", async () => {
    const args = {
      "title": "Автосделка: Ирина США Jet",
      "leadId": 36969059,
      "name": "Ирина",
      "telegram": "@golmgrein",
      "phone": "+17868368058",
      "email": "riana.talks@gmail.com",
      "fields": {
        "Актуальный этап (Основная воронка)": "В работе",
        "Переход в &quot;Новый лид&quot;": "1748965132",
        "Источник": "Реклама в Facebook",
        "utm_source": "fb",
        "utm_medium": "eva",
        "utm_campaign": "{{company__name}}",
        "utm_content": "{{adset_name}}",
        "utm_term": "{{ad_name}}",
        "Переход в &quot;В работе&quot;": "1749211991",
        "Причина отказа": "Партнёрство (франшиза)"
      },
      "leadSource": "fb",
      "tags": ["merged", "ФБ Евгения", "fb1357103122232251", "инвесткомитет10.06"],
      "description": "\nТеги:\nmerged, ФБ Евгения, fb1357103122232251, инвесткомитет10.06\n\nПоля:\nАктуальный этап (Основная воронка): В работе\nПереход в &quot;Новый лид&quot;: 1748965132\nИсточник: Реклама в Facebook\nutm_source: fb\nutm_medium: eva\nutm_campaign: {{company__name}}\nutm_content: {{adset_name}}\nutm_term: {{ad_name}}\nПереход в &quot;В работе&quot;: 1749211991\nПричина отказа: Партнёрство (франшиза)\n\nURL: https://impactcapital.amocrm.ru/leads/detail/36969059",
      "managerEmail": "popstas@gmail.com",
      "pipeline": "Академия Система"
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
