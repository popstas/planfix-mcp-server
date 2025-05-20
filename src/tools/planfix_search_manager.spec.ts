import { describe, expect, it } from 'vitest';
import { runTool } from '../helpers.js';

describe('planfix_search_manager tool', () => {
  it('searches manager by email=smirnov@expertizeme.org and returns manager_id', async () => {
    const args = {
      email: 'smirnov@expertizeme.org',
    };
    const {valid, content} = await runTool<{ managerId: number }>('planfix_search_manager', args);
    expect(valid).toBe(true);

    const { managerId } = content;
    expect(typeof managerId).toBe('number');
    expect(managerId).toBeGreaterThan(0);
  });
});
