import { describe, expect, it } from "vitest";
import { PLANFIX_FIELD_IDS } from "../config.js";
import { planfixRequest, runTool } from "../helpers.js";

// Whether the "additional emails" field (id 124 by default) actually exists on
// the connected account. The field is account-specific; on accounts where it is
// not configured the field-124 confirmation test below is skipped rather than
// producing a false failure.
async function emailAdditionalFieldExists(): Promise<boolean> {
  if (!PLANFIX_FIELD_IDS.emailAdditional) return false;
  try {
    const res = (await planfixRequest({
      path: "customfield/contact",
      method: "GET",
    })) as { customfields?: Array<{ id: number }> };
    return Boolean(
      res.customfields?.some((f) => f.id === PLANFIX_FIELD_IDS.emailAdditional),
    );
  } catch (error) {
    // A transport/auth failure is not "field absent" — surface it instead of
    // silently skipping the only end-to-end check of the write shape.
    throw new Error(
      `Could not list contact custom fields: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

describe("planfix_search_contact tool", () => {
  it('searches contact by name when both first and last names are provided (e.g., "Stanislav Popov")', async () => {
    const args = {
      name: "Stanislav Popov",
    };
    const { valid, content } = await runTool<{
      contactId: number;
      found: boolean;
    }>("planfix_search_contact", args);
    expect(valid).toBe(true);

    const { contactId, found } = content;
    expect(typeof contactId).toBe("number");
    expect(contactId).toBeGreaterThan(0);
    expect(typeof found).toBe("boolean");
    expect(found).toBe(true);
  });

  it('does not search by name when only first name is provided (e.g., "Stanislav")', async () => {
    const args = {
      name: "Stanislav",
    };
    const { valid, content } = await runTool<{
      contactId: number;
      found: boolean;
    }>("planfix_search_contact", args);
    expect(valid).toBe(true);
    expect(content.found).toBe(false);
  });

  it("searches contact by email and returns contact details", async () => {
    const args = {
      email: "pop.stas@gmail.com",
    };
    const { valid, content } = await runTool<{
      contactId: number;
      found: boolean;
    }>("planfix_search_contact", args);
    expect(valid).toBe(true);

    const { contactId, found } = content;
    expect(typeof contactId).toBe("number");
    expect(typeof found).toBe("boolean");
    // Contact might or might not be found depending on the test data
  });

  it("returns found: false when no contact is found", async () => {
    const args = {
      email: "nonexistent-email-12345@example.com",
    };
    const { valid, content } = await runTool<{ found: boolean }>(
      "planfix_search_contact",
      args,
    );
    expect(valid).toBe(true);
    expect(content.found).toBe(false);
  });

  // Confirms the system "secondary email" search path is accepted by the live
  // API: a search by an additional email must not error. The contact need not
  // exist (we use a random address) — this exercises the filter-4221 request
  // shape end-to-end without depending on any account-specific custom field,
  // which is exactly the case the custom-field round-trip below cannot cover.
  //
  // `planfixSearchContact` swallows per-filter errors (each `searchWithFilter`
  // catches and returns `found: false`), so going through the tool would report
  // success even if Planfix rejected filter 4221. To actually prove the request
  // shape is accepted, hit `contact/list` directly with the system 4221 filter
  // and assert the call resolves (a rejected shape makes `planfixRequest` throw
  // on the non-2xx response) with a well-formed result.
  it("accepts a search by additional email (system filter 4221)", async () => {
    const result = (await planfixRequest({
      path: "contact/list",
      body: {
        offset: 0,
        pageSize: 100,
        fields: "id,name,email,additionalEmailAddresses",
        filters: [
          {
            type: 4221,
            operator: "equal",
            value: `nonexistent-additional-${Date.now()}@example.com`,
          },
        ],
      },
    })) as { contacts?: Array<{ id: number }> };
    // No throw above means the 4221 request shape was accepted by the API.
    expect(Array.isArray(result.contacts ?? [])).toBe(true);
    expect(result.contacts?.length ?? 0).toBe(0);
  });

  // Confirms the custom-field ("additional emails") write shape end-to-end:
  // (1) the multi-value write format on create, (2) the match filter,
  // (3) the read-back. Creates a contact with a primary + additional email,
  // searches by the additional address, and expects a match. This round-trip
  // necessarily requires a numeric custom field because the system
  // additionalEmailAddresses field is read-only via the REST API (not writable
  // through ContactRequest), so a contact with system additional emails cannot
  // be created via the API. Skipped automatically on accounts where the custom
  // field is not configured (the field id is account-specific).
  it("matches a contact by an additional email (custom field)", async (ctx) => {
    if (!(await emailAdditionalFieldExists())) {
      ctx.skip();
      return;
    }
    const stamp = Date.now();
    const primaryEmail = `additional-primary-${stamp}@example.com`;
    const additionalEmail = `additional-extra-${stamp}@example.com`;

    const createResult = await runTool<{ contactId: number }>(
      "planfix_create_contact",
      {
        name: `Additional Email Test ${stamp}`,
        email: primaryEmail,
        additionalEmails: [additionalEmail],
      },
    );
    expect(createResult.valid).toBe(true);
    const createdId = createResult.content.contactId;
    expect(typeof createdId).toBe("number");
    expect(createdId).toBeGreaterThan(0);

    try {
      // The primary email must not be passed, so the match can only come from
      // the field-124 filter (or the additional email against the main field).
      const { valid, content } = await runTool<{
        contactId: number;
        found: boolean;
      }>("planfix_search_contact", {
        additionalEmails: [additionalEmail],
      });
      expect(valid).toBe(true);
      expect(content.found).toBe(true);
      expect(content.contactId).toBe(createdId);
    } finally {
      // Best-effort cleanup so repeated runs don't accumulate test contacts.
      try {
        await planfixRequest({
          path: `contact/${createdId}/delete`,
          body: {},
        });
      } catch (error) {
        // Not fatal — failing here would mask the assertions above. But it does
        // mean a contact is now leaking into the live account on every run, so
        // it must be visible rather than swallowed.
        console.warn(
          `[integration] Failed to delete test contact ${createdId}, delete it manually: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }, 60000);
});
