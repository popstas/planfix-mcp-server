# TODO

- [x] Использовать поле «Дополнительные адреса email» (системное поле id 124): проверять его при матчинге контактов и заполнять, если известно больше 1 email. Главное поле email — одиночное, дополнительное — множественное.

## Ревью PR #65 (additionalEmails) — исправить до merge

- [x] Blocker: non-force update стирает существующие additional emails — запись custom field заменяет значение, а отправляются только новые адреса (`planfix_update_contact.ts`, non-forceUpdate путь). Слать union `[...existingCustom, ...extras]` (без адресов из системного поля) + тест `["old"] + ["new"] → ["old","new"]`.
- [x] Blocker: default `PLANFIX_FIELD_ID_EMAIL_ADDITIONAL=124` всегда включён, но 124 — id системного (read-only) поля; на аккаунтах без такого custom field запись валит весь create/update контакта. Сделать default `0` (opt-in) и/или подтвердить реальный id на целевом аккаунте.
- [x] Поиск по одиночному `email` (без `additionalEmails`) не проверяет системный secondary-email фильтр 4221 — контакт с этим адресом в дополнительных не найдётся, будет создан дубликат. Включить 4221 при промахе основного фильтра 4026 и для одиночного email.
- [x] Update: из extras исключается только аргумент `email`, а не текущий `contact.email` — вызов только с `additionalEmails`, содержащим основной адрес контакта, продублирует его в дополнительное поле. Использовать `postBody.email ?? contact.email` — не `email ?? contact.email`: при non-force апдейте аргумент `email` не перезаписывает уже заполненный основной адрес, так что основным остаётся `contact.email`, и исключать надо именно его.
- [x] `addToLeadTask` игнорирует результат `updatePlanfixContact` — провал обновления (включая имя/телефон/email) полностью беззвучен. Пробрасывать/логировать ошибку.
- [x] `additionalEmails` — единственное поле в `UserDataInputSchemaBase` без `nullFix`: `additionalEmails: null` валит весь вызов parse-ошибкой. Обернуть в `nullFix`.
- [x] Нет ограничения размера `additionalEmails` — худший случай 3N+3 последовательных `contact/list` на один поиск. Добавить `.max()` (например 10) во все схемы.
- [x] `forceUpdate: true` с пустым/дедуплицированным в ноль набором не перезаписывает поле (гейт `extras.length`) — очистить поле нельзя. Определиться с семантикой и покрыть тестом.
- [x] Пробелы в тестах на неподтверждённых API-шейпах: чтение `contact.additionalEmailAddresses` (existingSystem merge) и строкового значения custom field не покрыты юнит-тестами.
- [x] Мелочи: дублирующий запрос 4026 когда primary входит в additionalEmails; слабый substring-assert `toContain("124")` в тесте search; мёртвые поля `additionalEmailAddresses`/124 в `fields` поиска (ответ не читается); README «merged into» не соответствует коду.
- [ ] Live-проверка на аккаунте с настроенным custom field: create → update (добавление второго адреса) → read-back → search по дополнительному адресу.
