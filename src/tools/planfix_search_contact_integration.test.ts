import { describe, expect, it } from 'vitest';
import { runTool } from '../helpers.js';

describe('planfix_search_contact tool', () => {
  it('searches contact by name when both first and last names are provided (e.g., "Tetiana Dadochkina")', async () => {
    const args = {
      name: 'Tetiana Dadochkina',
    };
    const {valid, content} = await runTool<{ contactId: number; found: boolean }>('planfix_search_contact', args);
    expect(valid).toBe(true);

    const { contactId, found } = content;
    expect(typeof contactId).toBe('number');
    expect(contactId).toBeGreaterThan(0);
    expect(typeof found).toBe('boolean');
    expect(found).toBe(true);
  });

  it('does not search by name when only first name is provided (e.g., "Tetiana")', async () => {
    const args = {
      name: 'Tetiana',
    };
    const {valid, content} = await runTool<{ contactId: number; found: boolean }>('planfix_search_contact', args);
    expect(valid).toBe(true);
    expect(content.found).toBe(false);
  });

  it('searches contact by email and returns contact details', async () => {
    const args = {
      email: 'test@example.com', // Replace with a valid test email
    };
    const {valid, content} = await runTool<{ contactId: number; found: boolean }>('planfix_search_contact', args);
    expect(valid).toBe(true);

    const { contactId, found } = content;
    expect(typeof contactId).toBe('number');
    expect(typeof found).toBe('boolean');
    // Contact might or might not be found depending on the test data
  });

  it('returns found: false when no contact is found', async () => {
    const args = {
      email: 'nonexistent-email-12345@example.com',
    };
    const {valid, content} = await runTool<{ found: boolean }>('planfix_search_contact', args);
    expect(valid).toBe(true);
    expect(content.found).toBe(false);
  });
});
