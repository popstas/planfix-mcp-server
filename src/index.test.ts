import { describe, it, expect } from 'vitest';
import * as dotenv from 'dotenv';
dotenv.config();

describe('Planfix MCP Server', () => {
  it('should load environment variables', () => {
    expect(process.env.PLANFIX_ACCOUNT).toBeDefined();
    expect(process.env.PLANFIX_TOKEN).toBeDefined();
  });
});
