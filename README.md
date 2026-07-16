# Planfix MCP Server

[![Coverage Status](https://coveralls.io/repos/github/popstas/planfix-mcp-server/badge.svg?branch=master)](https://coveralls.io/github/popstas/planfix-mcp-server?branch=master)

This MCP server provides integration with the Planfix API, allowing Model Context Protocol (MCP) clients to interact
with Planfix CRM and task management system.

## Features

- Lead management (create, search, convert to tasks)
- Lead searches can reuse a known `clientId` to skip contact lookups
- Contact and company management
- Task management (create, search, comment)
- Report generation and management
- Uses Planfix REST API v2.0 ([API docs](https://help.planfix.com/restapidocs/swagger.json))
- Authentication via Bearer token

## Configuration

The server requires the following environment variables for Planfix API access:

- `PLANFIX_ACCOUNT` – Your Planfix account name (e.g., `yourcompany`)
- `PLANFIX_TOKEN` – Planfix API token with necessary permissions
- `PLANFIX_BASE_URL` – (optional) Override the REST API base URL. Defaults to `https://<PLANFIX_ACCOUNT>.planfix.com/rest/`. Set this for `.ru` and other regional installations, e.g. `https://yourcompany.planfix.ru/rest/`
- `PLANFIX_ACCOUNT_URL` – (optional) Override the web origin used for human-facing links (task/contact/user pages). Defaults to `PLANFIX_BASE_URL` without the trailing `/rest/`
- `PLANFIX_FIELD_ID_EMAIL` – Custom field ID for email
- `PLANFIX_FIELD_ID_EMAIL_ADDITIONAL` – (optional, **no default**) Numeric **custom** field ID used to store additional email addresses (multi-value). Must point at a real multi-value custom field you created on your account; the system secondary-email field id `124` is *not* a valid write target. When unset, storing additional addresses is disabled (matching by the system field still works). The Planfix **system** secondary-email field (`additionalEmailAddresses`) is read-only over the REST API, so additional addresses are *written* to this custom field; *matching* uses both the system field (filter type 4221) and this custom field (see the `additionalEmails` argument below)
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
- `PLANFIX_FIELD_ID_LEAD_ID` – Custom field ID for external lead ID
- `PLANFIX_LEAD_TEMPLATE_ID` – ID of the lead task template
- `PLANFIX_TASK_TITLE_TEMPLATE` – Template for the default lead task title (e.g., `{name} - client's task`)

### config.yml

Custom fields can also be configured via `config.yml`. The default path is
`./data/config.yml`. Override it with the `--config=/abs/path/config.yml` CLI
flag or the `PLANFIX_CONFIG` environment variable. You can also specify a
different Planfix account when using a custom config:

```sh
PLANFIX_CONFIG=/etc/planfix-mcp.yml PLANFIX_ACCOUNT=demo \
npx @popstas/planfix-mcp-server
```

```yaml
proxyUrl: "http://localhost:8080"

webhook:
  enabled: false
  url: "https://example.com/hook"
  token: "<token>"
  skipPlanfixApi: false

leadTaskFields:
  - id: "456"
    name: "id сделки"
    argName: lead_id
    type: number
contactFields:
  - id: "123"
    name: "Резидентство"
    argName: resident
    type: enum
    values: ["резидент", "нерезидент", "иное"]
userFields:
  - id: "789"
    name: "Департамент"
    argName: department
    type: string
```

`proxyUrl` routes all Planfix REST API calls (including tool requests) through
the specified HTTP proxy.

Values from `config.yml` override matching entries from the legacy environment
variables when merged by `id`. User custom fields from this list are requested
individually by the `planfix_search_manager` tool so their values are available
in responses. Managers can be searched either by `email` or by numeric `id`
through this tool, enabling lookups when only an identifier is available.

#### Chat API

To create tasks from chat messages, add a `chatApi` block to `config.yml`:

```yaml
chatApi:
  useChatApi: true
  chatApiToken: "<token>"
  providerId: "<id>"
  baseUrl: "https://<account>.planfix.com/webchat/api"
```

- `chatApiToken` – token for Planfix Chat API requests.
- `providerId` – identifier of the chat provider configured in Planfix.
- `useChatApi` – enable Chat API integration. When `true`, task creation proceeds as:
  1. A chat is created via Chat API with the initial message.
  2. `getTask` retrieves the new task's `taskId`.
  3. Subsequent updates are made through the REST API.
- `baseUrl` – base URL for Chat API calls. Defaults to `https://<account>.planfix.com/webchat/api`.

#### Webhook

To post lead task payloads to a webhook before creating or updating a task,
add a `webhook` block to `config.yml`:

```yaml
webhook:
  enabled: true
  url: "https://example.com/hook"
  token: "<token>"
  skipPlanfixApi: false
```

- `enabled` – whether to send the lead task payload to the webhook URL.
- `url` – webhook endpoint URL.
- `token` – shared secret appended to the JSON payload as `token`.
- `skipPlanfixApi` – when `true`, the webhook response must include `taskId`, and
  the Planfix REST API call is skipped.

## Debug

```
npx @modelcontextprotocol/inspector node d:/projects/expertizeme/planfix-mcp-server/dist/index.js
```

### Logging

Set `LOG_LEVEL=debug` to enable detailed cache logs. Logs are written to `data/mcp.log`.

### Clearing Cache

Run `npm run cache-clear` to remove all cached Planfix API responses stored in `data/planfix-cache.sqlite3` and delete the objects cache file `data/planfix-cache.yml`.

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
        "PLANFIX_FIELD_ID_TAGS": "129",
        "PLANFIX_FIELD_ID_LEAD_ID": "130",
        "PLANFIX_LEAD_TEMPLATE_ID": "42",
        "PLANFIX_TASK_TITLE_TEMPLATE": "{name} - работа с клиентом"
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
PLANFIX_FIELD_ID_LEAD_ID=132 \
PLANFIX_FIELD_ID_TAGS=133 \
PLANFIX_LEAD_TEMPLATE_ID=42 \
PLANFIX_TASK_TITLE_TEMPLATE="{name} - работа с клиентом" \
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

## Tool Reference

### `planfix_create_sell_task`

- Creates a sell task using textual information about the agency and employee.
- Resolves the client, parent lead task, assignees, and agency IDs automatically based on the provided strings.
- Input fields (all strings):
  - `name`: Task title, e.g. `"Продажа {{ название товара }} на pressfinity.com"`.
  - `agency`: Agency/company name (optional).
  - `email`: Employee email used to locate the Planfix contact.
  - `contactName`/`employeeName`: Employee full name (optional).
  - `telegram`: Employee telegram username (optional).
  - `description`: Description with the list of ordered products.
  - `project`: Project name to associate with the sell task (optional).
- Returns `{ taskId, url }`.

### `planfix_create_sell_task_ids`

- Creates a sell task when Planfix identifiers are already known.
- Requires numeric `clientId` and optional `leadTaskId`, `agencyId`, and `assignees` (user IDs).
- Accepts `name`, `description`, and optional `project` string values.

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

- `searchPlanfixContact`: Search contacts by name, phone, email, or Telegram.
  When the primary `email` does not match the main email field, it is also matched
  against the system secondary-email field (filter type 4221) — this happens for a
  plain `email` search too, no extra configuration needed. The optional
  `additionalEmails: string[]` argument (max 10) adds each address to that same
  fallback, plus the custom field (filter type 4101, only when
  `PLANFIX_FIELD_ID_EMAIL_ADDITIONAL` is set) and the main email field.
- `createPlanfixContact`: Create a new contact in Planfix. Accepts an optional
  `additionalEmails: string[]` argument (max 10) that is written to the
  additional-emails custom field (`PLANFIX_FIELD_ID_EMAIL_ADDITIONAL`),
  deduplicated and excluding the primary `email`. (The system secondary-email
  field is read-only via the API.)
- `updatePlanfixContact`: Update existing contact information. Accepts an optional
  `additionalEmails: string[]` argument (max 10) that is merged into the
  additional-emails custom field. Planfix custom-field writes replace the whole
  value, so the field is rewritten with the union of what is already stored there
  and the genuinely new addresses; nothing is lost. Addresses already on the
  contact — in the custom field, in the read-only system secondary-email field, or
  as the primary `email` — are not added again. With `forceUpdate` the field is
  instead rewritten with exactly the addresses you pass, so an empty array clears
  it; omitting `additionalEmails` leaves the field untouched either way.
- `searchPlanfixCompany`: Search for companies by name

### Task Management

- `searchPlanfixTask`: Search for tasks by title, client ID and optional `templateId`
- `createSellTask`: Resolve contact/agency IDs and create a sell task
- `createSellTaskIds`: Create a sell task when IDs are already known
- `createLeadTask`: Create a new lead task. When `chatApi.useChatApi`
  is enabled, it sends the initial message through the Chat API, gets
  the resulting `taskId` via `getTask`, and then updates the task using
  the REST API. Accepts `message` and `contactName` fields.
- `addToLeadTask`: Create or update a lead task and update contact details.
  Accepts an optional `additionalEmails: string[]` argument that threads through
  contact search, creation, and update (matched against the system secondary-email
  field and the `PLANFIX_FIELD_ID_EMAIL_ADDITIONAL` custom field; written to the
  custom field).
  When `webhook.enabled` is true, it posts the input payload to the
  webhook endpoint, optionally skipping the Planfix API if `skipPlanfixApi`
  is set.
- `createTask`: Create a task using text fields
- `createComment`: Add a comment to a task
- `getChildTasks`: Retrieve child tasks of a parent task. Use `recursive` to
  fetch all descendant tasks as a flat list; returned tasks include
  `parent_task_id`.
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
