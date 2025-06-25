# Planfix MCP Server

This MCP server provides integration with the Planfix API, allowing Model Context Protocol (MCP) clients to interact
with Planfix CRM and task management system.

## Features

- Lead management (create, search, convert to tasks)
- Contact and company management
- Task management (create, search, comment)
- Report generation and management
- Uses Planfix REST API v2.0 ([API docs](https://help.planfix.com/restapidocs/swagger.json))
- Authentication via Bearer token

## Configuration

The server requires the following environment variables for Planfix API access:

- `PLANFIX_ACCOUNT` – Your Planfix account name (e.g., `yourcompany`)
- `PLANFIX_TOKEN` – Planfix API token with necessary permissions
- `PLANFIX_FIELD_ID_EMAIL` – Custom field ID for email
- `PLANFIX_FIELD_ID_PHONE` – Custom field ID for phone
- `PLANFIX_FIELD_ID_TELEGRAM` – Set any value to use the system Telegram field
- `PLANFIX_FIELD_ID_TELEGRAM_CUSTOM` – Custom field ID for Telegram when using the custom field
- `PLANFIX_FIELD_ID_CLIENT` – Custom field ID for client
- `PLANFIX_FIELD_ID_MANAGER` – Custom field ID for manager
- `PLANFIX_FIELD_ID_AGENCY` – Custom field ID for agency
- `PLANFIX_FIELD_ID_LEAD_SOURCE` – Custom field ID for lead source
- `PLANFIX_FIELD_ID_LEAD_SOURCE_VALUE` – Value ID for default lead source
- `PLANFIX_FIELD_ID_PIPELINE` – Custom field ID for pipeline
- `PLANFIX_FIELD_ID_TAGS` – Custom field ID for task tags
  - Missing tag names will be added automatically to the directory

## Debug

```
npx @modelcontextprotocol/inspector node d:/projects/expertizeme/planfix-mcp-server/dist/index.js
```

### Logging

Set `LOG_LEVEL=debug` to enable detailed cache logs. Logs are written to `data/mcp.log`.

## Example MCP Config (NPX)

```json
{
  "mcpServers": {
    "planfix": {
      "command": "npx",
      "args": [
        "-y",
        "@popstas/planfix-mcp-server"
      ],
      "env": {
        "PLANFIX_ACCOUNT": "yourcompany",
        "PLANFIX_TOKEN": "your-api-token",
        "PLANFIX_FIELD_ID_EMAIL": "123",
        "PLANFIX_FIELD_ID_PHONE": "124",
        "PLANFIX_FIELD_ID_TELEGRAM": "1",
        "PLANFIX_FIELD_ID_TELEGRAM_CUSTOM": "125",
        "PLANFIX_FIELD_ID_CLIENT": "126",
        "PLANFIX_FIELD_ID_MANAGER": "127",
        "PLANFIX_FIELD_ID_AGENCY": "128",
        "PLANFIX_FIELD_ID_TAGS": "129"
      }
    }
  }
}
```

## Usage

### Running the Server

Run the server with the required environment variables set. Example (with npx):

```sh
PLANFIX_ACCOUNT=yourcompany \
PLANFIX_TOKEN=your-api-token \
PLANFIX_FIELD_ID_EMAIL=123 \
PLANFIX_FIELD_ID_PHONE=124 \
PLANFIX_FIELD_ID_TELEGRAM=1 \
PLANFIX_FIELD_ID_TELEGRAM_CUSTOM=125 \
PLANFIX_FIELD_ID_CLIENT=126 \
PLANFIX_FIELD_ID_MANAGER=127 \
PLANFIX_FIELD_ID_AGENCY=128 \
PLANFIX_FIELD_ID_LEAD_SOURCE=129 \
PLANFIX_FIELD_ID_LEAD_SOURCE_VALUE=130 \
PLANFIX_FIELD_ID_PIPELINE=131 \
PLANFIX_FIELD_ID_TAGS=132 \
npx @popstas/planfix-mcp-server
```

To run the server over Server-Sent Events (SSE), use the `planfix-mcp-server-sse` command:

```sh
PLANFIX_ACCOUNT=yourcompany \
PLANFIX_TOKEN=your-api-token \
planfix-mcp-server-sse
```

### Using the Planfix Client

The Planfix client provides a convenient way to interact with the Planfix API directly from the command line.

#### Prerequisites

Make sure you have the following environment variables set in your `.env` file:

```
PLANFIX_ACCOUNT=your-account
PLANFIX_TOKEN=your-api-token
```

#### Basic Commands

1. **Test the connection**
   ```bash
   npm run planfix test
   ```

2. **Make a GET request**
   ```bash
   npm run planfix get user/current
   ```

3. **Make a POST request with data**
   ```bash
   npm run planfix post task/ --data '{"name":"Test Task","description":"Test Description"}'
   ```

4. **Search for objects**
   ```bash
   npm run planfix post object/list --data '{"filters":[{"type":1,"operator":"equal","value":"Продажа"}]}'
   ```

5. **Update an object (PUT request)**
   ```bash
   npm run planfix put task/123 --data '{"name":"Updated Task Name"}'
   ```

6. **Delete an object**
   ```bash
   npm run planfix delete task/123
   ```

#### Using in Code

```typescript
import { planfixClient } from './lib/planfix-client';

// Get current user
const user = await planfixClient.get('user/current');

// Create a new task
const newTask = await planfixClient.post('task/', {
  name: 'New Task',
  description: 'Task description',
  // ... other task properties
});

// Search for objects
const objects = await planfixClient.post('object/list', {
  filters: [
    {
      type: 1,
      operator: 'equal',
      value: 'Продажа'
    }
  ]
});
```

## Available Tools

### Lead Management

- `leadToTask`: Convert a lead to a task by creating/updating contact and task
- `searchLeadTask`: Search for lead tasks by contact information

### Contact Management

- `searchPlanfixContact`: Search contacts by name, phone, email, or Telegram
- `createPlanfixContact`: Create a new contact in Planfix
- `updatePlanfixContact`: Update existing contact information
- `searchPlanfixCompany`: Search for companies by name

### Task Management

- `searchPlanfixTask`: Search for tasks by title and client ID
- `createSellTask`: Create a new sell task with template
- `createLeadTask`: Create a new lead task
- `addToLeadTask`: Create or update a lead task and update contact details
- `createTask`: Create a task using text fields
- `createComment`: Add a comment to a task
- `getChildTasks`: Retrieve all child tasks of a parent task
- `updateLeadTask`: Update an existing lead task (only empty fields are updated unless `forceUpdate` is true)

### Directory Management

- `planfix_search_directory`: Search directories by name
- `planfix_search_directory_entry`: Search directory entry by directory name and entry name

### User Management

- `searchManager`: Find a manager by email

### Reporting

- `listReports`: List all available reports
- `runReport`: Generate and retrieve a specific report

## References

- [Planfix API Documentation](https://help.planfix.com/restapidocs/swagger.json)
- [Model Context Protocol](https://modelcontextprotocol.io)

## TODO:

- Add tool `getTask` to retrieve task details
- Add tool `getContact` to retrieve contact details
- Add tool `getManager` to retrieve manager details
- Add more comprehensive error handling and logging
- Add input validation for all API endpoints
- Add rate limiting and retry logic for API calls

---
MIT License
