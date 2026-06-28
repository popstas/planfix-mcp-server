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
  } catch {
    return false;
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

  // Confirms the field-124 ("additional emails") API shape end-to-end:
  // (1) the multi-value write format on create, (2) the field-124 match filter,
  // (3) the read-back. Creates a contact with a primary + additional email,
  // searches by the additional address, and expects a match.
  // Skipped automatically on accounts where the additional-emails field is not
  // configured (the field id is account-specific).
  it("matches a contact by an additional email (field 124)", async (ctx) => {
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
      } catch {
        // ignore cleanup failures
      }
    }
  }, 60000);
});
