# Planfix MCP Server

This MCP server provides integration with the Planfix API, allowing Model Context Protocol (MCP) clients to interact with Planfix CRM and task management system.

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
- `PLANFIX_FIELD_ID_TELEGRAM` – Custom field ID for Telegram
- `PLANFIX_FIELD_ID_CLIENT` – Custom field ID for client
- `PLANFIX_FIELD_ID_MANAGER` – Custom field ID for manager
- `PLANFIX_FIELD_ID_AGENCY` – Custom field ID for agency

## Debug
```
npx @modelcontextprotocol/inspector node d:/projects/expertizeme/planfix-mcp-server/dist/index.js
```

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
        "PLANFIX_FIELD_ID_TELEGRAM": "125",
        "PLANFIX_FIELD_ID_CLIENT": "126",
        "PLANFIX_FIELD_ID_MANAGER": "127",
        "PLANFIX_FIELD_ID_AGENCY": "128"
      }
    }
  }
}
```

## Usage
Run the server with the required environment variables set. Example (with npx):
```sh
PLANFIX_ACCOUNT=yourcompany \
PLANFIX_TOKEN=your-api-token \
PLANFIX_FIELD_ID_EMAIL=123 \
PLANFIX_FIELD_ID_PHONE=124 \
PLANFIX_FIELD_ID_TELEGRAM=125 \
PLANFIX_FIELD_ID_CLIENT=126 \
PLANFIX_FIELD_ID_MANAGER=127 \
PLANFIX_FIELD_ID_AGENCY=128 \
npx @popstas/planfix-mcp-server
```

## Available Tools

### Lead Management
- `leadToTask`: Convert a lead to a task by creating/updating contact and task
- `searchLeadTask`: Search for lead tasks by contact information

### Contact Management
- `searchPlanfixContact`: Search contacts by name, phone, email, or Telegram
- `createPlanfixContact`: Create a new contact in Planfix
- `searchPlanfixCompany`: Search for companies by name

### Task Management
- `searchPlanfixTask`: Search for tasks by name and client ID
- `createSellTask`: Create a new sell task with template
- `createLeadTask`: Create a new lead task
- `createComment`: Add a comment to a task
- `getChildTasks`: Retrieve all child tasks of a parent task

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
