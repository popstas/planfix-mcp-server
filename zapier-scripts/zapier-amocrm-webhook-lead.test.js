import { describe, it, expect } from "vitest";
import execute from "./zapier-amocrm-webhook-lead.js";

const inputBody = {
  "account[_links][self]": "https://example.amocrm.ru",
  "leads[add][0][id]": "123",
};

describe("zapier-amocrm-webhook-lead", () => {
  it("fetches lead and returns body", async () => {
    const fetchMock = async (url) => {
      if (url.endsWith("/api/v4/leads/123?with=contacts")) {
        return {
          ok: true,
          json: async () => ({ id: 123, _embedded: { contacts: [{ id: 1 }] } }),
        };
      }
      if (url.endsWith("/api/v4/contacts/1")) {
        return { ok: true, json: async () => ({ id: 1, name: "John" }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const result = await execute({ body: inputBody, token: "t" }, fetchMock);
    expect(result.body).toEqual(inputBody);
    expect(result.lead.id).toBe(123);
    expect(result.lead.contactsDetailed[0].id).toBe(1);
  });
});
