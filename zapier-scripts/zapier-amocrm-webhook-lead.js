/* global inputData */
/* global fetch */
const body = inputData.body || {};
const token = inputData.token;
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

return { body, lead };
