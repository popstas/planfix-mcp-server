# Zapier Scripts

This directory contains standalone scripts for use in Zapier.

## zapier-amocrm-webhook-lead.js

Fetches full lead information from amoCRM using data provided by an incoming
webhook. The script requires an amoCRM access token and returns the enriched
lead object together with the original webhook body. In addition it extracts
`taskParams` that can be passed to the `planfix_create_task` tool.

### Usage

```js
import execute from "./zapier-amocrm-webhook-lead.js";

const { body, lead, taskParams } = await execute(
  { body, token: "your_access_token" },
  fetch,
);
```

If `token` is omitted, the script will look for the `AMOCRM_ACCESS_TOKEN`
environment variable.

### Test
`node zapier-scripts/zapier-test-amocrm.js` - is for exec zapier-amocrm-webhook-lead.js with test environment variables.
It uses ZAPIER_INPUT_AMOCRM environment variable.