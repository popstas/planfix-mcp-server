# Fix PR #65 review findings: additionalEmails matching & filling

## Overview

PR #65 (branch `additional-emails-field-124`) added optional `additionalEmails: string[]`
support to contact search/create/update and the lead-task pipeline. A consolidated code
review found two blockers and a set of secondary issues that must be fixed before merge:

1. **Data loss on update**: the non-`forceUpdate` path writes only the *new* addresses to
   the additional-emails custom field, but Planfix custom-field writes replace the value —
   existing stored addresses are silently erased.
2. **Dangerous default**: `PLANFIX_FIELD_ID_EMAIL_ADDITIONAL` defaults to `124`, which is
   the id of the read-only *system* field, not a real custom field. On accounts without a
   custom field 124 the write can fail the entire contact create/update, and
   `addToLeadTask` swallows update errors entirely.

Plus: search by a single `email` never checks the system secondary-email filter (4221),
the update path excludes only the argument `email` (not `contact.email`) from extras,
`forceUpdate` cannot clear the field, `additionalEmails` lacks `nullFix` and a size cap,
and several test/docs gaps.

## Context

- Adopted from `docs/TODO.md`, section "Ревью PR #65 (additionalEmails) — исправить до merge".
- Work happens on the existing PR branch `additional-emails-field-124` (PR #65 is open).
- Files involved:
  - `src/tools/planfix_update_contact.ts` — additional-emails write (data loss, primary
    exclusion, forceUpdate-clear).
  - `src/tools/planfix_search_contact.ts` — 4221 fallback for single email, duplicate 4026
    query, unused fields in the request.
  - `src/tools/planfix_add_to_lead_task.ts` — swallowed `updatePlanfixContact` result.
  - `src/config.ts` — `emailAdditional` default.
  - `src/types.ts`, `src/tools/planfix_search_contact.ts`, `planfix_create_contact.ts`,
    `planfix_update_contact.ts` — schema hardening (`nullFix`, `.max()`).
  - `README.md` — defaults and merge-semantics wording.
- API facts (confirmed in the PR's plan against the Planfix contact swagger):
  - System field `additionalEmailAddresses` is read-only over REST; matched via system
    filter type 4221 (no `field` id).
  - Custom numeric field is matched via filter type 4101 and written via
    `customFieldData: [{ field: { id }, value: string[] }]`; **writes replace the value**.
- Existing unit tests encode the destructive non-force write
  (`planfix_update_contact.test.ts`, "writes field 124 with genuinely-new additional
  emails") — they must be updated together with the fix.

## Development Approach

- Testing approach: regular (code first, then tests) per task.
- Complete each task fully before moving to the next.
- Update this plan when scope changes during implementation.
- Preserve backward compatibility: `additionalEmails` stays optional everywhere; with the
  new default the custom-field write path becomes opt-in (off unless
  `PLANFIX_FIELD_ID_EMAIL_ADDITIONAL` is set).

## Testing Strategy

- Unit tests (`npm run test`, mocked `planfixRequest`) required for every code-changing
  task; assert exact request bodies/filters.
- Run project tests after each task before proceeding.
- Full gate at the end: `npm run test-full` (typecheck + unit tests + lint).
- Live confirmation of the custom-field round-trip stays a manual Post-Completion step
  (needs an account with the custom field configured).

## Progress Tracking

- Mark completed items with `[x]` immediately when done.
- Update plan if implementation deviates from original scope.

## Technical Details

- **Non-force update write** must send the union of existing custom-field values and the
  genuinely-new addresses: `[...existingCustom, ...extras]`. Addresses that live only in
  the read-only system field are still used for dedup (don't re-add them) but are NOT
  copied into the custom field.
- **Primary exclusion on update**: use `email ?? contact.email` when computing extras, so
  a call carrying only `additionalEmails` cannot duplicate the contact's current primary
  address into the custom field.
- **forceUpdate semantics**: with `forceUpdate: true` and `additionalEmails` provided, the
  field is rewritten with the deduped provided set even when it is empty (allows
  clearing). Without `additionalEmails` the field is untouched, as today.
- **Search for a single email**: on a primary-email (4026) miss, try the system
  secondary-email filter 4221 with that email even when `additionalEmails` is absent —
  filter 4221 is account-agnostic and this was the intent of the original TODO item.
  The custom-field (4101) tier stays gated on both `additionalEmails` presence and a
  configured field id.
- **Default off**: `emailAdditional: Number(process.env.PLANFIX_FIELD_ID_EMAIL_ADDITIONAL || 0)`
  — all 4101/write paths already guard on truthiness, so `0` disables them.
- **Schema hardening**: wrap `additionalEmails` in `nullFix(...)` in
  `UserDataInputSchemaBase` (every sibling contact field already is); add `.max(10)` to
  the array in all four schemas to cap API-call amplification (worst case today is 3N+3
  sequential `contact/list` calls per search).

## Implementation Steps

### Task 1: Fix data-loss and primary-exclusion in updatePlanfixContact

- [x] non-`forceUpdate` path: write the union `[...existingCustom, ...extras]` to the
      custom field instead of `extras` alone (system-field addresses still excluded from
      the written value but kept in the dedup set)
- [x] exclude `email ?? contact.email` (not just the `email` argument) when computing extras
- [x] `forceUpdate` path: when `additionalEmails` is provided, rewrite the field with the
      deduped set even if it is empty (allow clearing); leave the field untouched when
      `additionalEmails` is absent
- [x] update the existing unit test that asserts the destructive write; add tests:
      `["old"] + ["new"] → ["old", "new"]`; only-`additionalEmails` call with the
      contact's primary address does not duplicate it; `forceUpdate` + `[]` clears the field
- [x] write tests for new/changed functionality
- [x] run project tests - must pass before next task

### Task 2: Opt-in custom field id and surfaced update errors

- [x] change `emailAdditional` default in `src/config.ts` from `124` to `0` (feature off
      unless `PLANFIX_FIELD_ID_EMAIL_ADDITIONAL` is explicitly set)
- [x] `addToLeadTask`: stop discarding the `updatePlanfixContact` result — capture its
      `error` into the accumulated `errors` like the create path does
- [x] update README: the env var has no default, must point at a real multi-value custom
      field created on the account; system field id 124 is not a valid write target
- [x] adjust unit tests that relied on the implicit 124 default (mocks already set
      `emailAdditional: 124` explicitly in create/update/search contact tests — no change
      needed)
- [x] write tests for new/changed functionality
- [x] run project tests - must pass before next task

### Task 3: Search by single email checks the secondary-email filter (4221)

- [x] on a primary-email (4026) miss, try filter 4221 with the primary email even when
      `additionalEmails` is absent
- [x] exclude the primary email from the 4026 fallback loop values (no duplicate query
      when an additional email equals the primary)
- [x] keep the 4101 tier gated on `additionalEmails` presence and a configured field id
- [x] tests: single-`email` search falls back to 4221 and finds the contact; fallback
      order 4026 → 4221 → 4101 → 4026-additional preserved; no duplicate primary query
- [x] write tests for new/changed functionality
- [x] run project tests - must pass before next task

### Task 4: Schema hardening (nullFix, size cap)

- [x] wrap `additionalEmails` in `nullFix(...)` in `UserDataInputSchemaBase` (`src/types.ts`)
      so `additionalEmails: null` no longer fails the whole tool call
- [x] add `.max(10)` to the `additionalEmails` array in all four schemas (types.ts, search,
      create, update)
- [x] tests: `additionalEmails: null` is tolerated through `addToLeadTask` parsing; an
      oversized array is rejected with a clear validation error
- [x] write tests for new/changed functionality
- [x] run project tests - must pass before next task

### Task 5: Close test gaps and minor cleanups

- [ ] add unit tests for the update read paths with no live confirmation yet: existing
      addresses coming from `contact.additionalEmailAddresses` (system field) and a
      single-string custom-field value
- [ ] strengthen the weak substring assertion in `planfix_search_contact.test.ts`
      (`toContain("124")` on the joined fields string → exact `split(",")` membership)
- [ ] remove the unused `additionalEmailAddresses` and custom-field id entries from the
      search request `fields` (the search response never reads them), or read them —
      pick removal unless a concrete consumer exists
- [ ] sweep README/docs wording to match final behavior (merge semantics on update,
      opt-in env var, 4221 fallback for a single email)
- [ ] write tests for new/changed functionality
- [ ] run project tests - must pass before next task

### Task 6: Verify acceptance criteria

- [ ] verify all requirements from Overview are implemented (union write, opt-in default,
      surfaced update errors, 4221 for single email, nullFix, `.max()`, test gaps closed)
- [ ] run full project test suite (`npm run test-full`)
- [ ] run project linter - all issues must be fixed

## Post-Completion

*Items requiring manual intervention - no checkboxes, informational only*

- Live verification on an account with a configured multi-value custom field: set
  `PLANFIX_FIELD_ID_EMAIL_ADDITIONAL`, then create → update (add a second address) →
  read-back → search by the additional address (`npm run test:integration` with a valid
  `PLANFIX_TOKEN`), confirming write shape, filter behavior, and replace semantics.
- Push the branch and re-request review on PR #65; the review checklist in `docs/TODO.md`
  can then be checked off / removed.
