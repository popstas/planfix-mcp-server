/* global inputData */
/* global fetch */
const body = inputData.body || {};
const token = inputData.token || process.env.AMOCRM_ACCESS_TOKEN;
if (!token) throw new Error("AMOCRM access token is required");

const baseUrl = (body["account[_links][self]"] || "").replace(/\/$/, "");
const leadId = body["leads[add][0][id]"];
if (!baseUrl || !leadId) throw new Error("Invalid webhook body");

async function amoGet(path) {
  console.log(`amoCRM request: ${baseUrl}${path}`);
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
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
  const params = { title: lead.name };
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

const taskParams = extractTaskParams();

return { body, lead, taskParams };
