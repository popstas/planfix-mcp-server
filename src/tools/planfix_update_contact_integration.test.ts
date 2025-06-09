import { describe, it, expect } from 'vitest';

import { runTool } from '../helpers.js';


describe('planfix_update_contact tool prod', () => {
  
  it('updates contact by id', async () => {
    const args = {
      contactId: 30,
      email: 'pop..stas@gmail.com',
    };
    const {valid, content} = await runTool<{ contactId: number }>('planfix_update_contact', args);
    expect(valid).toBe(true);

    const { contactId } = content;
    expect(typeof contactId).toBe('number');
    expect(contactId).toBeGreaterThan(0);
  });

});

  