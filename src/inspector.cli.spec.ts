import {execa} from 'execa';
import {describe, expect, it} from 'vitest';

// CLI script and base arguments for all tests
const CLI_SCRIPT = 'npm';
const CLI_ARGS = ['-s', 'run', 'mcp-cli', '--'];

/**
 * Helper to run the CLI with given arguments and parse JSON output.
 * Throws with stderr if JSON parsing fails.
 */
async function runCli(args: string[]) {
  try {
    const {stdout} = await execa(CLI_SCRIPT, args, {stdin: 'inherit'});
    return JSON.parse(stdout);
  } catch (error: any) {
    // Print error and CLI output for easier debugging
    if (error.stdout) {
      console.error('CLI STDOUT:', error.stdout);
    }
    if (error.stderr) {
      console.error('CLI STDERR:', error.stderr);
    }
    throw error;
  }
}

describe('MCP Inspector CLI', () => {
  it('returns a tools list via tools/list', async () => {
    const args = [...CLI_ARGS, '--method', 'tools/list'];
    const parsed = await runCli(args);
    expect(parsed).toHaveProperty('tools');
    expect(Array.isArray(parsed.tools)).toBe(true);
    expect(parsed.tools.length).toBeGreaterThan(0);
  });

  it('searches manager by email=smirnov@expertizeme.org and returns manager_id', async () => {
    const args = [
      ...CLI_ARGS,
      '--method', 'tools/call',
      '--tool-name', 'planfix_search_manager',
      '--tool-arg', 'email=smirnov@expertizeme.org',
    ];
    const parsed = await runCli(args);
    expect(parsed).toHaveProperty('content');
    expect(Array.isArray(parsed.content)).toBe(true);
    expect(parsed.content.length).toBeGreaterThan(0);
    const {managerId} = JSON.parse(parsed.content[0].text);
    expect(typeof managerId).toBe('number');
    expect(managerId).toBeGreaterThan(0);
  }, 10000);

  it('searches contact by name=Dadochkina Tetiana', async () => {
    const args = [
      ...CLI_ARGS,
      '--method', 'tools/call',
      '--tool-name', 'planfix_search_contact',
      '--tool-arg', 'name=Dadochkina Tetiana',
    ];
    const parsed = await runCli(args);
    expect(parsed).toHaveProperty('content');
    expect(Array.isArray(parsed.content)).toBe(true);
    expect(parsed.content.length).toBeGreaterThan(0);
    const {contactId} = JSON.parse(parsed.content[0].text);
    expect(typeof contactId).toBe('number');
    expect(contactId).toBeGreaterThan(0);
  }, 10000);

  it('searches lead task by userData.email=astrazaq@gmail.com', async () => {
    const args = [
      ...CLI_ARGS,
      '--method', 'tools/call',
      '--tool-name', 'planfix_search_lead_task',
      '--tool-arg', 'email=astrazaq@gmail.com',
    ];
    const parsed = await runCli(args);
    expect(parsed).toHaveProperty('content');
    expect(Array.isArray(parsed.content)).toBe(true);
    expect(parsed.content.length).toBeGreaterThan(0);
    const {taskId} = JSON.parse(parsed.content[0].text);
    expect(typeof taskId).toBe('number');
    expect(taskId).toBeGreaterThan(0);
  });
  it('creates sell task for pop.stas@gmail.com, orderId: 99', async () => {

    // Create a description with a placeholder URL to avoid command interpretation issues
    // const description = [
    //   'Заказ № 99',
    //   'Сумма: 690.00',
    //   'Способ оплаты: Phone ordering',
    //   'Ссылка на заказ: [ORDER_LINK]',
    //   'Клиент:',
    //   '- Телефон: +79222222222',
    //   '- Email: pop.stas@gmail.com',
    //   'Примечания к заказу:',
    //   'comment',
    //   'Товары:',
    //   '- 690 USD- Yahoo News/Finance (AccessWire) (622)'
    // ].join('\n');
    const description = 'Заказ № 99, Сумма: 690.00, Способ оплаты: Phone ordering, Ссылка на заказ: [ORDER_LINK]Заказ № 99, Сумма: 690.00, Способ оплаты: Phone ordering, Ссылка на заказ: [ORDER_LINK]';

    const taskData = {
      clientId: 20576,
      leadTaskId: 860779,
      agencyId: 18555,
      assignees: [258],
      name: 'Продажа по заказу №99',
      description: description,
    };

    try {
      const args = [
        ...CLI_ARGS,
        '--method', 'tools/call',
        '--tool-name', 'planfix_create_sell_task',
        '--tool-arg', `clientId=${taskData.clientId}`,
        '--tool-arg', `leadTaskId=${taskData.leadTaskId}`,
        '--tool-arg', `agencyId=${taskData.agencyId}`,
        '--tool-arg', `assignees=${JSON.stringify(taskData.assignees)}`,
        '--tool-arg', `name='${taskData.name}'`,
        '--tool-arg', `description='${taskData.description}'`,
      ];

      const parsed = await runCli(args);

      // If we get here, the MCP server responded, but we should still check for errors
      if (parsed.error) {
        console.error('MCP server error:', parsed.error);
        console.error('CLI STDERR:', parsed.stderr);
        // throw new Error(`MCP server error: ${parsed.error}`);
      }

      expect(parsed).toHaveProperty('content');
      expect(Array.isArray(parsed.content)).toBe(true);
      expect(parsed.content.length).toBeGreaterThan(0);

      const response = JSON.parse(parsed.content[0].text);
      expect(response).toHaveProperty('taskId');
      expect(typeof response.taskId).toBe('number');
      expect(response.taskId).toBeGreaterThan(0);
    } catch (error) {
      // Provide more detailed error information
      console.error('Test failed with error:', error);
      if (error instanceof Error && error.message.includes('Connection closed')) {
        console.error('The MCP server connection was closed. Make sure the MCP server is running and properly configured.');
        console.error('You may need to set up the following environment variables:');
        console.error('- PLANFIX_ACCOUNT');
        console.error('- PLANFIX_TOKEN');
        console.error('- PLANFIX_BASE_URL');
        console.error('- PLANFIX_FIELD_ID_* (various field IDs)');
      }
      throw error; // Re-throw to fail the test
    }
  }, 10000);
  it('returns error for invalid tool name', async () => {
    const args = [
      ...CLI_ARGS,
      '--method', 'tools/call',
      '--tool-name', 'nonexistent_tool',
    ];
    let errorCaught = false;
    try {
      const parsed = await runCli(args);
      expect(parsed).toHaveProperty('error');
    } catch (err: any) {
      errorCaught = true;
      expect(err).toBeTruthy();
      // Optionally check error message or code
    }
    expect(errorCaught).toBe(true);
  });
});
