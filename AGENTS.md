# AGENTS.md

This repository contains a Model Context Protocol (MCP) server written in TypeScript that integrates with the Planfix CRM REST API. The server exposes several tools located in `src/tools` which can be called by MCP clients.

## Coverage improve rules
- Run `npm test` and `npm run coverage-info` to check coverage, sorted by lines_uncovered.
- Prefer less covered files.
- Cover each function first.
- Check `npm run coverage-info` in the end of each iteration, calculate coverage change.

## Rules before commit
- Run `npm run test-full` before commit.
- Run `npm run format` before commit.
- Update `README.md` when tools change.

# Pull request naming
Create name using angular commit message format.
`feat:` and `fix:` are using in CHANGELOG.md. It's a release notes for developers. Name your PRs in a way that it's easy to understand what was changed. Forbidden to use `feat:` and `fix:` prefixes for chore tasks that don't add new features or fix bugs.
When change single tool, name PR as `feat(toolName): description` or `fix(toolName): description`.

## Development commands

- **Build**: `npm run build`
- **Development mode**: `npm run dev`
- **Type checking**: `npm run typecheck`
- **Lint all files**: `npm run lint src`
- **Lint specific file**: `npm run lint [filePath]`
- **Run tests**: `npm run test`
- **Run a single tool test**: `npm test [toolName]`

## Conventions

- Do **not** use `z.union` when defining Zod schemas.
- When modifying code in `src/tools`, update or create the corresponding test file named `[toolName].test.ts`.
- Ensure tool imports in `src/index.ts` are sorted alphabetically.
- Planfix API documentation: <https://help.planfix.com/restapidocs/swagger.json>
- Examples of complex filters:
  - Tasks: <https://planfix.com/ru/help/REST_API:_Сложные_фильтры_задач>
  - Contacts: <https://help.planfix.com/ru/REST_API:_Сложные_фильтры_контактов>

## Environment variables

The server relies on several Planfix related environment variables. At minimum set:

```
PLANFIX_ACCOUNT=your-account
PLANFIX_TOKEN=your-api-token
PLANFIX_FIELD_ID_EMAIL=123
PLANFIX_FIELD_ID_PHONE=124
PLANFIX_FIELD_ID_TELEGRAM=1
PLANFIX_FIELD_ID_TELEGRAM_CUSTOM=125
PLANFIX_FIELD_ID_CLIENT=126
PLANFIX_FIELD_ID_MANAGER=127
PLANFIX_FIELD_ID_AGENCY=128
```

Place these variables in an `.env` file or export them before running commands.

## Voice summary

When you believe a task is finished, announce a short summary using `smarthome_tts_voice`. If a user explicitly asks for a voice answer, provide it with that tool as well.

