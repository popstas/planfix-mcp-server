import { describe, expect, it } from 'vitest';
import { runTool } from '../helpers.js';

describe('planfix_search_task tool', () => {
  it('searches task by name="Корягин Егор - работа с клиентом" and returns taskId', async () => {
    const args = {
      taskName: 'Корягин Егор - работа с клиентом',
    };
    const { valid, content } = await runTool<{ taskId: number }>('planfix_search_task', args);
    expect(valid).toBe(true);

    const { taskId } = content;
    expect(typeof taskId).toBe('number');
    expect(taskId).toBeGreaterThan(0);
  });
});
