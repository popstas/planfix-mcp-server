import { describe, expect, it } from 'vitest';
import { runTool } from '../helpers.js';

describe('planfix_search_contact tool', () => {
  it('searches contact by name=Tetiana Dadochkina', async () => {
    const args = {
      name: 'Tetiana Dadochkina',
    };
    const {valid, content} = await runTool<{ contactId: number }>('planfix_search_contact', args);
    expect(valid).toBe(true);

    const { contactId } = content;
    expect(typeof contactId).toBe('number');
    expect(contactId).toBeGreaterThan(0);
  });
});
