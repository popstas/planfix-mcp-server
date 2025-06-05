import { describe, expect, it } from 'vitest';
import { runTool } from '../helpers.js';

describe('planfix_request tool', () => {
  it('makes a GET request to the Planfix API', async () => {
    const args = {
      method: 'GET',
      path: 'project/current',
      body: {
        offset: 0,
        pageSize: 1
      }
    };
    
    const { valid, content } = await runTool('planfix_request', args);
    
    expect(valid).toBe(true);
    expect(content).toHaveProperty('projects');
    expect(Array.isArray(content.projects)).toBe(true);
  });

  it('makes a POST request to the Planfix API', async () => {
    const args = {
      method: 'POST',
      path: 'contact/list',
      body: {
        offset: 0,
        pageSize: 1
      }
    };
    
    const { valid, content } = await runTool('planfix_request', args);
    
    expect(valid).toBe(true);
    expect(content).toHaveProperty('contacts');
    expect(Array.isArray(content.contacts)).toBe(true);
  });

  it('returns error for invalid endpoint', async () => {
    const args = {
      method: 'GET',
      path: 'nonexistent/endpoint',
    };
    
    const { valid, content } = await runTool('planfix_request', args);
    
    expect(valid).toBe(true);
    expect(content).toHaveProperty('success', false);
    expect(content).toHaveProperty('error');
    expect(content).toHaveProperty('path', 'nonexistent/endpoint');
  });
});
