/* global inputData */
/* global fetch */
const body = inputData.body || {};
const token = inputData.token || process.env.AMOCRM_ACCESS_TOKEN;
if (!token) throw new Error("AMOCRM access token is required");

const baseUrl = (body["account[_links][self]"] || "").replace(/\/$/, "");
const leadId = body["leads[add][0][id]"];
const leadName = body["leads[add][0][name]"];
if (!baseUrl || !leadId) throw new Error("Invalid webhook body");

async function amoGet(path) {
  console.log(`amoCRM request: ${baseUrl}${path}`);
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
  const params = { title: `${lead.name} (Сделка #${lead.id})` };

  const tagNames = Array.isArray(lead._embedded?.tags)
    ? lead._embedded.tags.map((t) => t.name).filter(Boolean)
    : [];

  const customFields = Array.isArray(lead.custom_fields_values)
    ? lead.custom_fields_values
    : [];
  const customLines = [];
  for (const f of customFields) {
    const name = f.field_name || f.field_code;
    if (!name) continue;
    const values = Array.isArray(f.values)
      ? f.values.map((v) => v.value).filter(Boolean)
      : [];
    if (values.length) {
      customLines.push(`${name}: ${values.join(', ')}`);
    }
  }

  const descriptionParts = [];
  if (tagNames.length) {
    descriptionParts.push(`Теги: ${tagNames.join(', ')}`);
  }
  if (customLines.length) {
    descriptionParts.push('', 'Поля:', ...customLines);
  }
  descriptionParts.push(
    '',
    `URL: ${baseUrl}/leads/detail/${leadId}`,
  );

  params.description = descriptionParts.join('\n');
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`amoCRM request failed: ${res.status} ${text}`);
  }
  return res.json();
}

const lead = await amoGet(`/api/v4/leads/${leadId}?with=contacts`);
const detailedContacts = [];
const contacts =
  lead._embedded && Array.isArray(lead._embedded.contacts)
    ? lead._embedded.contacts
    : [];

for (const c of contacts) {
  const full = await amoGet(`/api/v4/contacts/${c.id}`);
  detailedContacts.push(full);
}

lead.contactsDetailed = detailedContacts;

function extractTaskParams() {
  const params = { title: `${leadName} (${lead.name}` };
  const mainContactId = contacts.find((c) => c.is_main)?.id;
  const mainContact =
    detailedContacts.find((c) => c.id === mainContactId) || detailedContacts[0];
  if (mainContact) {
    if (mainContact.name) {
      params.name = mainContact.name;
    }
    const fields = Array.isArray(mainContact.custom_fields_values)
      ? mainContact.custom_fields_values
      : [];
    for (const f of fields) {
      if (f.field_code === "PHONE" && Array.isArray(f.values) && f.values[0]) {
        params.phone = f.values[0].value;
      }
      if (f.field_code === "EMAIL" && Array.isArray(f.values) && f.values[0]) {
        params.email = f.values[0].value;
      }
      if (f.field_code === "IM" && Array.isArray(f.values)) {
        const tg = f.values.find((v) => v.enum_code === "TELEGRAM");
        if (tg) params.telegram = tg.value;
      }
    }
  }
  return params;
}

// POST https://bot-dev.stable.popstas.ru/agent/planfix/tool/planfix_create_task
// token at inputData.agent_token
async function createTask(taskParams) {
  const res = await fetch(`https://bot-dev.stable.popstas.ru/agent/planfix/tool/planfix_create_task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inputData.agent_token}`,
    },
    body: JSON.stringify(taskParams),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`planfix_create_task request failed: ${res.status} ${text}`);
  }
  return res.json();
}

const taskParams = extractTaskParams();

const task = await createTask(taskParams);

return { body, lead, taskParams, task };
