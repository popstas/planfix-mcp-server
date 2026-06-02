# Changelog

All notable changes to this project are documented here.


## Unreleased

### Features

- config: Support PLANFIX_BASE_URL override for .ru/regional accounts

## v1.8.8 - 2026-05-04

### Features

- directory: Add allowCreate flag

## v1.8.7 - 2026-01-30

### Features

- get_child_tasks: Add getChildTasks.showDescription config

## v1.8.6 - 2026-01-30

### Features

- planfix_search_contact: Add byTelegramUrl filter

## v1.8.5 - 2026-01-14

### Bug Fixes

- planfix_search_contact: Check Telegram mismatch
- planfix_search_task: Get last task

## v1.8.4 - 2026-01-08

### Miscellaneous

- planfix_add_to_lead_task: Add webhook payload

## v1.8.3 - 2026-01-08

### Bug Fixes

- planfix_add_to_lead_task: Coerce IDs to numbers

## v1.8.2 - 2026-01-07

### Bug Fixes

- webhook: Move api_key to headers

### Testing

- planfix_add_to_lead_task: Fix webhook test

## v1.8.1 - 2026-01-07

### Features

- planfix_add_to_lead_task: Move webhook handling (#62)
- planfix_create_lead_task: Add webhook integration (#61)

## v1.8.0 - 2025-11-28

### Testing

- Fix proxy test

## v1.7.1 - 2025-11-28

### Features

- Add proxy support for Planfix requests (#60)

## v1.7.0 - 2025-11-26

### Features

- planfix_search_lead_task: Support clientId in lead task search (#59)
- planfix_search_manager: Allow searching managers by id (#58)
- planfix_search_manager: Support custom user fields from config.userFields (#57)
- planfix_get_child_tasks: Add recursive option to tool (#56)
- Support chat API for lead task creation (#49)

### Documentation

- Document chat API config (#51)

### Refactor

- Add chat API request helper (#48)
- Add Chat API config loader

### Testing

- Ensure chat API updates called once (#50)

## v1.6.0 - 2025-07-23

### CustomField

- Handbook_record create/update

## v1.5.10 - 2025-07-21

### Bug Fixes

- Add helper nullFix for convert null to undefined for optional fields

## v1.5.9 - 2025-07-15

### Features

- Add instagram_custom

## v1.5.7 - 2025-07-08

### Bug Fixes

- Add instagram to createContact, was only in updateContact

## v1.5.6 - 2025-07-07

### Features

- Add instagram field to contact handlers (#43)

## v1.5.5 - 2025-07-07

### Bug Fixes

- Fix AddToLeadTaskOutputSchema: groups id is number

## v1.5.4 - 2025-07-04

### Features

- Add customizable lead task title, default no title (#42)

### Bug Fixes

- Describe create_task fields

## v1.5.3 - 2025-07-03

### Bug Fixes

- PlanfixCreateTask: make title optional

## v1.5.2 - 2025-07-03

### Bug Fixes

- Fix task title override by client name at planfix_add_to_lead_task
- Remove console.log from mcp functions

### Documentation

- Show account override via PLANFIX_CONFIG (#41)
- Add changelog

## v1.5.1 - 2025-07-01

### Bug Fixes

- Don't update client just after creation

## v1.5.0 - 2025-06-30

### Features

- cache: Allow clearing planfix objects cache
- Add YAML config for custom fields (#23)
- Update task status to closed

### Bug Fixes

- Add error to output when failed to creaate contact while creating task
- No default templateId for planfix_search_task
- Remove leadSource, pipeline from description

### Miscellaneous

- Npm run coverage-info

### Testing

- Reset modules in searchPlanfixTask tests
- Improve coverage
- Add coverage for entry and server scripts
- Cover planfixRequest
- Add PlanfixClient tests
- Add coverage for isValidToolResponse
- Add unit tests for search task
- Add unit tests for createSellTask
- Add coverage for helpers and planfix_request
- Improve coverage
- Add unit tests for planfix_search_contact
- Add coverage for utility libs

## v1.4.0 - 2025-06-25

### Features

- Add Lead ID support to Planfix tools, PLANFIX_FIELD_ID_LEAD_ID (#22)

## v1.3.2 - 2025-06-25

### Features

- Lead task update with and without forceUpdate (#18)

### Bug Fixes

- Better custom field errors output when create task (#21)

## v1.3.1 - 2025-06-24

### Features

- Add SSE server

### Documentation

- Document debug logging

## v1.3.0 - 2025-06-23

### Features

- Add pipeline field
- Add planfix_update_lead_task tool (#15)
- Create leadSource if not exists

## v1.2.2 - 2025-06-18

### Features

- Add tags support for new tasks (#14)
- Update contact in add to lead task

### Bug Fixes

- Empty contact name update

### Testing

- Add broken int test

## v1.2.1 - 2025-06-18

### Bug Fixes

- Client name from phone/email/telegram
- Comment notify assignees by default

## v1.1.1 - 2025-06-17

### Miscellaneous

- Build before publish

## v1.1.0 - 2025-06-17

### Features

- Define task title, header, message -> title, description (#12)
- Add directory search tools and caching
- Add objects cache with all fields ids (#8)
- Add planfix_create_task tool (#6)
- Support system Telegram field (#5)
- New tool: planfix_update_contact (#3)

### Bug Fixes

- Add description to create_task

### Miscellaneous

- Add prettier format

### Refactor

- Move env telegram field ids to PLANFIX_FIELD_IDS

### Styling

- Format with prettier

### Testing

- Separate integration tests (#4)

## v1.0.9 - 2025-06-06

### Features

- Add project support for tasks (#2)
- PLANFIX_DRY_RUN
- Planfix_request abstract tool, for planfix-api agent
- Sale source at lead task, fix assignees output schema
- Planfix_run_report processRows
- Planfix_run_report: fix and cache, default: 10 minutes
- Planfix_get_report_fields
- Get_order: add saleSource, serviceMatrix
- First commit: working order management tools

### Bug Fixes

- Planfix-api workflow, second try
- Search by nameTranslated, ignore telegram in phone field, search by telegram with "at"
- Add `found` to search functions, rename .spec.js to .test.js
- Fix schema
- Better error reporting without env

### Documentation

- Add AGENTS guidelines (#1)
- CLAUDE.md by claude /init

### Miscellaneous

- Add shebang to index.ts
- Fix ignores

### Refactor

- Lint, types, reformat
- Split index.ts to modules

### Testing

- Speedup tests x2
- Write tests for all read only tools

