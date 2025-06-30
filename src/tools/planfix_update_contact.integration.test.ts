import { describe, it, expect } from "vitest";

import { runTool } from "../helpers.js";

describe("planfix_update_contact tool prod", () => {
  it("updates contact by id", async () => {
    const args = {
      contactId: 11,
      email: "pop..stas@gmail.com",
      telegram: "pop.stas",
      phone: "+79222222222",
      name: "Stanislav Popov",
      // resident: "В процессе",
    };
    const { valid, content } = await runTool<{ contactId: number }>(
      "planfix_update_contact",
      args,
    );
    expect(valid).toBe(true);

    const { contactId } = content;
    expect(typeof contactId).toBe("number");
    expect(contactId).toBeGreaterThan(0);
  });
});
