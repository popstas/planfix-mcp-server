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

## Release Process

Versioning is SemVer, releases are driven by **git tags** (`vX.Y.Z`). The changelog is
generated from [Conventional Commits](https://www.conventionalcommits.org/) with
[git-cliff](https://git-cliff.org/) (config: `cliff.toml`). `task:`-prefixed commits
(docs/TODO.md edits) and bare version-bump commits are excluded from the changelog.

Steps for a release (pick the bump from the changes — patch=fixes, minor=features, major=breaking):

1. Start from a clean `master` that is in sync with `origin` and has green tests
   (`npm run test-full`).
2. Bump the version without tagging yet:
   `npm version <patch|minor|major> --no-git-tag-version`
   (updates `package.json` + `package-lock.json`).
3. Render the changelog for the new version (moves "Unreleased" into the version section):
   `npx git-cliff --tag vX.Y.Z -o CHANGELOG.md`
4. Commit with the bare version as the message (matching existing history):
   `git commit -am "X.Y.Z"`
5. Create an annotated tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`
6. Push commit + tag: `git push --follow-tags origin master`
7. The tag push triggers `.github/workflows/release.yml`, which runs `git-cliff --latest`
   and creates the **GitHub Release** with the generated notes. (CI also runs `test.yml`
   on the pushed commit.)

**npm publish is NOT automated.** Publishing `@popstas/planfix-mcp-server` to the npm
registry is a **manual step**. After pushing the tag and confirming the GitHub Release,
**suggest running `npm publish`** as the final step of every release:

```sh
npm publish    # triggers prepublishOnly -> prepare-build (build + typecheck + test + lint)
```

npm auth tokens are configured at the **user level** (`~/.npmrc`), so `npm publish` works
locally without per-project setup. `prepublishOnly` guards the publish so a broken
build/test never reaches npm. Tagging/GitHub Release and npm publish are independent — a tag
does not publish to npm, so don't forget the publish step.

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