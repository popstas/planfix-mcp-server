# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to `dist/` directory
- **Development**: `npm run dev` - Runs server with tsx for development
- **Type checking**: `npm run typecheck` - Validates TypeScript without emitting files
- **Linting**: `npm run lint` - Runs ESLint to check code style
- **Testing**: `npm run test` - Runs Vitest test suite
- **Single test**: `npx vitest run <test-file>` - Run specific test file
- **Debug with MCP Inspector**: `npx @modelcontextprotocol/inspector node dist/index.js`

## Architecture Overview

This is a Model Context Protocol (MCP) server that provides integration with the Planfix CRM API. The server exposes tools that can be called by MCP clients to interact with Planfix.

### Core Structure

- **Entry point**: `src/index.ts` - Sets up MCP server with stdio transport and registers all tools
- **Configuration**: `src/config.ts` - Environment variables and Planfix API configuration
- **Tools**: `src/tools/` - Individual tool implementations, each file exports a tool with handler
- **Types**: `src/types.ts` - Shared TypeScript types and Zod schemas

### Tool Pattern

Each tool in `src/tools/` follows this pattern:
- Uses Zod for input/output schema validation
- Exports a tool object with name, description, inputSchema, and handler function
- Handler makes HTTP requests to Planfix REST API v2.0
- Returns structured data with error handling

### Key Configuration

The server requires specific Planfix environment variables:
- `PLANFIX_ACCOUNT` - Account name
- `PLANFIX_TOKEN` - API bearer token
- `PLANFIX_FIELD_ID_*` - Custom field IDs for email, phone, telegram, client, manager, agency

### API Integration

- All Planfix API calls go through `planfixRequest()` helper in `helpers.js`
- Uses Bearer token authentication
- Base URL format: `https://{account}.planfix.com/rest/`
- Handles custom fields for contact data (email, phone, telegram)

### Testing

- Uses Vitest with 30-second timeout for API calls
- Limited to 4 concurrent tests to prevent rate limiting
- Test files use `.test.ts` extension
- Some tools have corresponding test files that make real API calls