import { describe, expect, it } from 'vitest';
import { runTool } from '../helpers.js';

describe('planfix_search_lead_task tool', () => {
  it('searches lead task by email=astrazaq@gmail.com and returns taskId', async () => {
    const args = {
      email: 'astrazaq@gmail.com',
    };
    const {valid, content} = await runTool<{ taskId: number }>('planfix_search_lead_task', args);
    expect(valid).toBe(true);
 
    const { taskId } = content;
    expect(typeof taskId).toBe('number');
    expect(taskId).toBeGreaterThan(0);
  });
});
