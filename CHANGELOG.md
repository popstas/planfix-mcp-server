## [1.5.1](https://github.com/popstas/planfix-mcp-server/compare/v1.5.0...v1.5.1) (2025-07-01)


### Bug Fixes

* don't update client just after creation ([bf6221d](https://github.com/popstas/planfix-mcp-server/commit/bf6221d4cada25e7a44f63071c568ecfa0aece8a))



# [1.5.0](https://github.com/popstas/planfix-mcp-server/compare/v1.4.0...v1.5.0) (2025-06-30)


### Bug Fixes

* add error to output when failed to creaate contact while creating task ([8d15757](https://github.com/popstas/planfix-mcp-server/commit/8d15757cb5da2d446d4ed2d093f716e6afae17a6))
* no default templateId for planfix_search_task ([f0f2e5e](https://github.com/popstas/planfix-mcp-server/commit/f0f2e5e77e92b61f17622d190c9925aa5ee21a02))
* remove leadSource, pipeline from description ([9d43cc5](https://github.com/popstas/planfix-mcp-server/commit/9d43cc5f6d41e2c810f07e534ac5195370149e3c))


### Features

* Add YAML config for custom fields ([#23](https://github.com/popstas/planfix-mcp-server/issues/23)) ([889a5ed](https://github.com/popstas/planfix-mcp-server/commit/889a5ed7c45f87de0cd45a5e055e605e798e079a))
* **cache:** allow clearing planfix objects cache ([ed25ed0](https://github.com/popstas/planfix-mcp-server/commit/ed25ed099ca57354b9ec0c9cb0862e33955ee48e))
* update task status to closed ([cd21632](https://github.com/popstas/planfix-mcp-server/commit/cd2163229e7d513357fe19f32955173927139721))



# [1.4.0](https://github.com/popstas/planfix-mcp-server/compare/v1.3.2...v1.4.0) (2025-06-25)


### Features

* Add Lead ID support to Planfix tools, PLANFIX_FIELD_ID_LEAD_ID ([#22](https://github.com/popstas/planfix-mcp-server/issues/22)) ([89a3a04](https://github.com/popstas/planfix-mcp-server/commit/89a3a043b72c11b24fa4c4384cba50d9de5cd611))



## [1.3.2](https://github.com/popstas/planfix-mcp-server/compare/v1.3.1...v1.3.2) (2025-06-25)


### Bug Fixes

* better custom field errors output when create task ([#21](https://github.com/popstas/planfix-mcp-server/issues/21)) ([2cabc1e](https://github.com/popstas/planfix-mcp-server/commit/2cabc1e1fee37eb9accb62fa79560bf228c3506a))


### Features

* lead task update with and without forceUpdate ([#18](https://github.com/popstas/planfix-mcp-server/issues/18)) ([715925c](https://github.com/popstas/planfix-mcp-server/commit/715925cbab96a4003d7435bc1bc7aec1e91912d1))



## [1.3.1](https://github.com/popstas/planfix-mcp-server/compare/v1.3.0...v1.3.1) (2025-06-24)


### Features

* add SSE server ([0f8fe06](https://github.com/popstas/planfix-mcp-server/commit/0f8fe068402eb157cf924e7c7232d881cfb33c45))



# [1.3.0](https://github.com/popstas/planfix-mcp-server/compare/v1.2.2...v1.3.0) (2025-06-23)


### Features

* add pipeline field ([0004213](https://github.com/popstas/planfix-mcp-server/commit/0004213c004d1292a6f791fced8a4172ec96360a))
* Add planfix_update_lead_task tool ([#15](https://github.com/popstas/planfix-mcp-server/issues/15)) ([7a9fab3](https://github.com/popstas/planfix-mcp-server/commit/7a9fab36545c64aea24a5577455023f4bf3542fc))
* create leadSource if not exists ([227aed9](https://github.com/popstas/planfix-mcp-server/commit/227aed9d69f6bede65d7b9e4c15f3944308d150b))



## [1.2.2](https://github.com/popstas/planfix-mcp-server/compare/v1.2.1...v1.2.2) (2025-06-18)


### Bug Fixes

* empty contact name update ([510bcf0](https://github.com/popstas/planfix-mcp-server/commit/510bcf04127260bd1bfddac14ce5bf198768ed28))


### Features

* Add tags support for new tasks ([#14](https://github.com/popstas/planfix-mcp-server/issues/14)) ([27450f0](https://github.com/popstas/planfix-mcp-server/commit/27450f0def428d955b2bc0bd660d7766f3395788))
* update contact in add to lead task ([bef8c5c](https://github.com/popstas/planfix-mcp-server/commit/bef8c5c1df903f453b6fa3eace23d34065f1d551))



## [1.2.1](https://github.com/popstas/planfix-mcp-server/compare/v1.2.0...v1.2.1) (2025-06-18)


### Bug Fixes

* client name from phone/email/telegram ([e41a567](https://github.com/popstas/planfix-mcp-server/commit/e41a5679604b8281bcab19ba95fe9924ec4d2f2c))
* comment notify assignees by default ([f464738](https://github.com/popstas/planfix-mcp-server/commit/f46473889b611690a47b5e2b0870e4d4870be657))



# [1.2.0](https://github.com/popstas/planfix-mcp-server/compare/v1.1.1...v1.2.0) (2025-06-17)


### Features

* add directory search tools and caching ([8cade23](https://github.com/popstas/planfix-mcp-server/commit/8cade23831a04f2443d831fb9999b21970eb890e))



## [1.1.1](https://github.com/popstas/planfix-mcp-server/compare/v1.1.0...v1.1.1) (2025-06-17)



# [1.1.0](https://github.com/popstas/planfix-mcp-server/compare/v1.0.9...v1.1.0) (2025-06-17)


### Bug Fixes

* add description to create_task ([fff3ca4](https://github.com/popstas/planfix-mcp-server/commit/fff3ca4db9dce4fadd0f85998d05347646bae2c7))


### Features

* Add objects cache with all fields ids ([#8](https://github.com/popstas/planfix-mcp-server/issues/8)) ([3a99323](https://github.com/popstas/planfix-mcp-server/commit/3a993237c03b5f69a103d0a7f84b18bead6f8003))
* Add planfix_create_task tool ([#6](https://github.com/popstas/planfix-mcp-server/issues/6)) ([b60ea5f](https://github.com/popstas/planfix-mcp-server/commit/b60ea5fc95404f168db7ce2662abac39554d4887))
* define task title, header, message -> title, description ([#12](https://github.com/popstas/planfix-mcp-server/issues/12)) ([601dc71](https://github.com/popstas/planfix-mcp-server/commit/601dc71850eece60ca203bb8bf22f56bd544018f))
* New tool: planfix_update_contact ([#3](https://github.com/popstas/planfix-mcp-server/issues/3)) ([dabde21](https://github.com/popstas/planfix-mcp-server/commit/dabde21acba268f46914631342cdfea00b9fd899))
* Support system Telegram field ([#5](https://github.com/popstas/planfix-mcp-server/issues/5)) ([f439493](https://github.com/popstas/planfix-mcp-server/commit/f439493b97242993f9ad893d247534f869ed3f80))



## [1.0.9](https://github.com/popstas/planfix-mcp-server/compare/949e86174153e3e160122b78661e76055a4148af...v1.0.9) (2025-06-06)


### Bug Fixes

* add `found` to search functions, rename .spec.js to .test.js ([40f295b](https://github.com/popstas/planfix-mcp-server/commit/40f295b50caedd2bbc95b2077906636553b28f88))
* better error reporting without env ([3c2fe92](https://github.com/popstas/planfix-mcp-server/commit/3c2fe92e47eb8de10cd415305265569a2da33885))
* fix schema ([638c65a](https://github.com/popstas/planfix-mcp-server/commit/638c65aa45da9415f915302df17912ebe0711f7a))
* planfix-api workflow, second try ([8a2bdfb](https://github.com/popstas/planfix-mcp-server/commit/8a2bdfb5842a7dbab39034ecb63690340f686609))
* search by nameTranslated, ignore telegram in phone field, search by telegram with "at" ([f465979](https://github.com/popstas/planfix-mcp-server/commit/f4659797d5cca77836b1bb09b52ffc253dcfdc7e))


### Features

* Add project support for tasks ([#2](https://github.com/popstas/planfix-mcp-server/issues/2)) ([0d49077](https://github.com/popstas/planfix-mcp-server/commit/0d49077da7eda5907ca517d02ff79ce4abc5b330))
* first commit: working order management tools ([949e861](https://github.com/popstas/planfix-mcp-server/commit/949e86174153e3e160122b78661e76055a4148af))
* get_order: add saleSource, serviceMatrix ([612e822](https://github.com/popstas/planfix-mcp-server/commit/612e82231af6e8ca2135bd6a97976155ba301d9e))
* PLANFIX_DRY_RUN ([e9c149d](https://github.com/popstas/planfix-mcp-server/commit/e9c149d45d22cc864194560cd574ddf69a0fe267))
* planfix_get_report_fields ([e101f86](https://github.com/popstas/planfix-mcp-server/commit/e101f86cb6e570de164f9afef820fb25c8d80fbc))
* planfix_request abstract tool, for planfix-api agent ([58c4f42](https://github.com/popstas/planfix-mcp-server/commit/58c4f4268a8e3f1e46ed575f1b6d7efd4d7b39d0))
* planfix_run_report processRows ([92c84bd](https://github.com/popstas/planfix-mcp-server/commit/92c84bd5d8a08153d16cb9cf519bda647e395359))
* planfix_run_report: fix and cache, default: 10 minutes ([28e3ced](https://github.com/popstas/planfix-mcp-server/commit/28e3ced4dfd0eb4e0b76a2410948d8dfc4b67650))
* sale source at lead task, fix assignees output schema ([65223f6](https://github.com/popstas/planfix-mcp-server/commit/65223f65e7832feba58867fcc0d79616a6c7be2c))



