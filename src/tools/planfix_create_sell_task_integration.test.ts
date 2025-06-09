import { describe, expect, it } from "vitest";
import { runTool } from "../helpers.js";

describe("planfix_create_sell_task tool", () => {
  it.skip("creates sell task for pop.stas@gmail.com, orderId: 99", async () => {
    const taskData = {
      clientId: 20576,
      leadTaskId: 860779,
      agencyId: 18555,
      assignees: [258],
      name: "Продажа по заказу №99",
      description:
        "Заказ № 99, Сумма: 690.00, Способ оплаты: Phone ordering, Ссылка на заказ: [ORDER_LINK]Заказ № 99, Сумма: 690.00, Способ оплаты: Phone ordering, Ссылка на заказ: [ORDER_LINK]",
    };

    const args = {
      clientId: taskData.clientId,
      leadTaskId: taskData.leadTaskId,
      agencyId: taskData.agencyId,
      assignees: taskData.assignees,
      name: taskData.name,
      description: taskData.description,
    };

    const { valid, content } = await runTool<{ taskId: number }>(
      "planfix_create_sell_task",
      args,
    );
    expect(valid).toBe(true);

    const { taskId } = content;
    expect(typeof taskId).toBe("number");
    expect(taskId).toBeGreaterThan(0);
  });
});
