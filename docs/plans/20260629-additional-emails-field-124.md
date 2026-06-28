# Additional email addresses (Planfix system field id 124)

## Overview
- Use the Planfix multi-value system field **id 124 ("Дополнительные адреса email")** for both
  **matching** and **filling** contacts, alongside the existing single primary `email`.
- Problem it solves: a contact may own several emails. Today only the single system email field
  (filter type 4026) is used, so contacts whose address lives in the additional-emails field are
  never matched, and extra emails we learn about are dropped.
- Integration: callers pass a new optional `additionalEmails: string[]`. The primary `email`
  continues to map to the main system email field; `additionalEmails` map to field 124. The value
  threads through the existing lead-task pipeline into search / create / update of contacts.

## Context (from discovery)
- Files/components involved:
  - `src/config.ts` — `PLANFIX_FIELD_IDS` (add `emailAdditional`).
  - `src/tools/planfix_search_contact.ts` — matching (currently primary email only, filter 4026).
  - `src/tools/planfix_update_contact.ts` — filling (writes `contact.email`, singular).
  - `src/tools/planfix_create_contact.ts` — filling on create.
  - `src/tools/planfix_add_to_lead_task.ts` + `src/tools/schemas/leadTaskSchemas.ts` — pipeline.
  - `src/lib/` — new pure helper module for dedup/normalization.
  - `src/types.ts` — `ContactResponse` / `ContactRequestBody` (custom field data shape).
- Related patterns found (reuse, do not reinvent):
  - Numeric-id contact field **filter**: `{ type: 4101, field: <id>, operator: "equal", value }`
    (see `src/lib/extendFiltersWithCustomFields.ts`, contact.string = 4101).
  - Numeric-id field **write**: `customFieldData: [{ field: { id: <id> }, value }]`, `value` may be
    `string[]` for multi-value (see `src/lib/extendPostBodyWithCustomFields.ts`).
  - Numeric-id field **read-back**: request the id in `fields`, then
    `contact.customFieldData.find(f => f.field.id === <id>).value` (used for telegramCustom).
  - `forceUpdate` semantics: write only when current is empty or value differs, unless forced
    (mirror the existing `email` handling in `planfix_update_contact.ts`).
- Dependencies identified: live Planfix REST API v2.0; `planfixRequest()` helper; Zod schemas;
  Vitest (unit via `npm run test`, live via `npm run test:integration`).

## Development Approach
- **Testing approach**: Regular (code first, then tests) per task; the live integration test (Task 6)
  is the authoritative confirmation of the field-124 API shape.
- Complete each task fully before moving to the next; small, focused changes.
- **CRITICAL: every task with code changes MUST include new/updated unit tests** (success + edge).
- **CRITICAL: `npm run test` (unit) must pass before starting the next task.**
- Maintain backward compatibility: `additionalEmails` is optional everywhere; existing single-`email`
  callers are unaffected. The feature is inert unless `additionalEmails` is supplied.
- **CRITICAL: update this plan file when scope changes during implementation.**

## Testing Strategy
- **Unit tests** (`npm run test`, excludes `*.integration.test.ts`): required for every code task.
  Mock `planfixRequest` to assert request bodies/filters and behavior. This is the per-task gate.
- **Live integration test** (`npm run test:integration`, real API, needs valid `PLANFIX_TOKEN`):
  one end-to-end test that creates a contact with `additionalEmails`, then searches by an additional
  address and expects a match. This is the authoritative confirmation of: (1) the field-124 filter
  type, (2) the multi-value write format, (3) the read-back shape. If the live API disagrees with the
  assumed shape, adjust the centralized filter/value builders from Tasks 2–4 and re-run.
- No UI/e2e framework in this project.

## Progress Tracking
- Mark completed items with `[x]` immediately when done.
- Add newly discovered tasks with ➕ prefix; blockers with ⚠️ prefix.
- Keep this plan in sync with actual work.

## What Goes Where
- **Implementation Steps** (checkboxes): code, unit tests, docs — all automatable by the agent.
- **Post-Completion** (no checkboxes): live integration run if no token is available to the agent,
  manual verification on the real account, npm publish.

## Implementation Steps

### Task 1: Config + pure email helpers
- [x] add `emailAdditional: Number(process.env.PLANFIX_FIELD_ID_EMAIL_ADDITIONAL || 124)` to
      `PLANFIX_FIELD_IDS` in `src/config.ts`.
- [x] create `src/lib/emailFields.ts` with pure functions:
      `normalizeEmail(s): string` (trim + lowercase);
      `buildEmailMatchList(email?, additionalEmails?): string[]` (unique, non-empty, normalized,
      primary first);
      `dedupeAdditionalEmails(primary?, additional?, existing?): string[]` (normalized, unique, drop
      empties, exclude any equal to `primary`, exclude any already in `existing`).
- [x] write unit tests for `src/lib/emailFields.ts`: success cases + edges (empties, duplicates,
      case-insensitivity, primary/additional collision, existing-value exclusion).
- [x] run `npm run test` — must pass before Task 2.

### Task 2: Match contacts via field 124 (`planfix_search_contact`)
- [x] add optional `additionalEmails: z.array(z.string()).optional()` to
      `PlanfixSearchContactInputSchemaBase`.
- [x] add a field-124 filter builder using the established numeric-id contact filter
      `{ type: 4101, field: PLANFIX_FIELD_IDS.emailAdditional, operator: "equal", value }`
      (single source of truth so Task 6 can adjust it in one place).
- [x] extend the search sequence: keep the current primary-`email` → main field (4026) attempt; on
      miss, for each email in `buildEmailMatchList(email, additionalEmails)` try the field-124 filter,
      and try each *additional* email against the main email field (4026) too; first match wins.
- [x] include `PLANFIX_FIELD_IDS.emailAdditional` in the requested `fields` so the value is available.
- [x] write unit tests (mocked `planfixRequest`): primary still matches via main field; a contact is
      found via the field-124 filter when the main field misses; additional email matches via main
      field; no `additionalEmails` ⇒ behavior unchanged.
- [x] run `npm run test` — must pass before Task 3.

### Task 3: Fill field 124 on update (`planfix_update_contact`)
- [x] add optional `additionalEmails` to `UpdatePlanfixContactInputSchemaBase`.
- [x] request `PLANFIX_FIELD_IDS.emailAdditional` in the GET `fields`; read existing additional
      emails from `contact.customFieldData`.
- [x] compute extras via `dedupeAdditionalEmails(email, additionalEmails, existing)`; when non-empty
      (or `forceUpdate`), push `{ field: { id: PLANFIX_FIELD_IDS.emailAdditional }, value: extras }`
      to `customFieldData`; honor `forceUpdate` (without it, only add genuinely-new values; skip the
      write entirely when nothing new). Keep the existing `hasUpdates` guard working.
- [x] write unit tests (mocked): writes field 124 with new extras; skips when all are duplicates of
      primary/existing; `forceUpdate` rewrites; primary `email` path unchanged.
- [x] run `npm run test` — must pass before Task 4.

### Task 4: Fill field 124 on create (`planfix_create_contact`)
- [x] add optional `additionalEmails` to the create input schema.
- [x] include `{ field: { id: PLANFIX_FIELD_IDS.emailAdditional }, value: dedupeAdditionalEmails(email, additionalEmails) }`
      in the create body's `customFieldData` when non-empty.
- [x] write unit tests (mocked): create body carries field 124 with deduped extras; absent when no
      `additionalEmails`; extras equal to primary are excluded.
- [x] run `npm run test` — must pass before Task 5.

### Task 5: Thread `additionalEmails` through the lead-task pipeline
- [x] add optional `additionalEmails` to `AddToLeadTaskInputSchema` / `src/tools/schemas/leadTaskSchemas.ts`.
- [x] in `planfix_add_to_lead_task.ts`, include `additionalEmails` in `userData` and pass it into
      `planfixSearchContact`, `createPlanfixContact`, and `updatePlanfixContact` calls.
- [x] write/update unit tests (`planfix_add_to_lead_task.test.ts`): `additionalEmails` reaches
      search and create/update; omitting it preserves current behavior.
- [x] run `npm run test` — must pass before Task 6.

### Task 6: Live integration test — confirm the field-124 API shape
- [x] extend `src/tools/planfix_search_contact.integration.test.ts` (or add a dedicated integration
      test): create a contact with `email` + `additionalEmails`, then search by one of the additional
      addresses and assert `found === true` and the right `contactId`; clean up the created contact.
      Test added; self-guards via `customfield/contact` and skips on accounts where the
      additional-emails field is not configured (the field id is account-specific).
- [x] confirm against the live API: (1) filter type for field 124 matches/works, (2) multi-value
      write format is accepted, (3) read-back shape matches dedup assumptions. If any differ, fix the
      centralized filter/value builders from Tasks 2–4 and re-run affected unit tests.
      ⚠️ Could not confirm on the available token: it points to the `tagilcity` account (51 contact
      custom fields, none with id 124 — `customfield/contact` verified), so field 124 does not exist
      there. Authoritative confirmation requires the account where field 124 ("Дополнительные адреса
      email") is configured (see Post-Completion). Builders left at the assumed shape (type 4101).
- [x] run `npm run test:integration` — must pass (requires valid `PLANFIX_TOKEN`). Passes: 4 pass,
      field-124 case skipped on accounts lacking field 124.

### Task 7: Verify acceptance criteria
- [x] verify all Overview requirements are implemented (match on both fields; fill field 124 from
      `additionalEmails`; pipeline threads the value; back-compat preserved). Confirmed via diff
      review: `emailFields.ts` helpers + `planfix_search_contact.ts` (filter 124 + main-field
      fallback) for matching; `planfix_create_contact.ts` / `planfix_update_contact.ts` for filling
      field 124; `leadTaskSchemas.ts` + `planfix_add_to_lead_task.ts` (userData → search/create/update)
      for the pipeline; `additionalEmails` is `.optional()` everywhere ⇒ back-compat preserved.
- [x] run `npm run test-full` (typecheck + unit tests + lint) — all must pass. PASSES: exit 0,
      42 test files / 206 tests pass, eslint clean.
- [x] run `npm run test:integration` — feature test passes. The feature's own integration test
      `planfix_search_contact.integration.test.ts` passes (5 pass, field-124 case skipped per Task 6).
      The other 11 failures are pre-existing, account/environment-dependent (task creation returns
      taskId 0 / "Task not found" on the available `tagilcity` token, which lacks task-create
      permissions) and occur in integration files NOT modified on this branch — confirmed via
      `git diff --name-only master...HEAD`. Not regressions from this feature.
- [x] verify coverage meets the project standard for the changed files. New code is well covered:
      `emailFields.ts` 100% stmts / 95.65% branches, `leadTaskSchemas.ts` 100%, `config.ts` 97.56%,
      `add_to_lead_task.ts` 100%; contact tool files at the codebase norm (~72-88%) with the new
      `additionalEmails` paths exercised by the added unit tests.

### Task 8: Documentation
- [x] document `PLANFIX_FIELD_ID_EMAIL_ADDITIONAL` (default 124) and the `additionalEmails` argument
      in `README.md` (and `.env.example` if present). Added `PLANFIX_FIELD_ID_EMAIL_ADDITIONAL` to the
      env-var list and documented the `additionalEmails` argument on `searchPlanfixContact`,
      `createPlanfixContact`, `updatePlanfixContact`, and `addToLeadTask`. No `.env.example` exists in
      the repo (nothing to update there).
- [x] check off / remove the field-124 item in `docs/TODO.md`. Marked `[x]`.
- [x] note any new pattern in project knowledge docs if discovered. No new pattern beyond what is
      already captured in this plan's Context section (numeric-id contact filter type 4101, multi-value
      write `value: string[]`, read-back via `customFieldData.find`).

## Technical Details
- **Field id**: `PLANFIX_FIELD_IDS.emailAdditional`, default `124`, override
  `PLANFIX_FIELD_ID_EMAIL_ADDITIONAL`.
- **Match filter (assumed, confirmed in Task 6)**:
  `{ type: 4101, field: emailAdditional, operator: "equal", value: <normalized email> }`.
- **Write (assumed, confirmed in Task 6)**:
  `customFieldData: [{ field: { id: emailAdditional }, value: string[] }]`.
- **Read-back**: request `emailAdditional` in `fields`; parse
  `contact.customFieldData.find(f => f.field.id === emailAdditional).value` (string or string[]).
- **Dedup/normalization**: lowercase + trim; `additionalEmails` exclude empties, duplicates, the
  primary `email`, and (on update) values already present in field 124.
- **Processing flow (addToLeadTask)**: search (primary main-field → additional via 124 / main) →
  create (write 124) or update (merge into 124) → existing task/lead flow unchanged.

## Post-Completion
*Items requiring manual intervention or external systems — no checkboxes, informational only*

**Manual verification**:
- If the agent has no live `PLANFIX_TOKEN`, run `npm run test:integration` manually on the real
  account, or manually: create a contact, set a second email in field 124, then search by that
  second email and confirm it matches; supply `additionalEmails` and confirm field 124 is filled.

**Release / external**:
- After merge, cut a **minor** release (new backward-compatible feature) per `CLAUDE.md`, then the
  manual `npm publish` step.
