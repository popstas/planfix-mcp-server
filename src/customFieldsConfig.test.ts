import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { loadCustomFieldsConfig, getConfigPath } from "./customFieldsConfig.js";

function tmpFile(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pfcfg-"));
  const file = path.join(dir, "config.yml");
  fs.writeFileSync(file, content);
  return file;
}

afterEach(() => {
  delete process.env.PLANFIX_CONFIG;
  delete process.env.PLANFIX_LEAD_TASK_FIELDS;
  delete process.env.PLANFIX_CONTACT_FIELDS;
  delete process.env.PLANFIX_USER_FIELDS;
  process.argv = process.argv.filter((a) => !a.startsWith("--config="));
});

describe("customFieldsConfig", () => {
  it("loads config from PLANFIX_CONFIG", () => {
    const file = tmpFile("leadTaskFields: []\ncontactFields: []");
    process.env.PLANFIX_CONFIG = file;
    const cfg = loadCustomFieldsConfig();
    expect(cfg.leadTaskFields.length).toBe(0);
    expect(getConfigPath()).toBe(file);
  });

  it("yaml overrides env vars", () => {
    process.env.PLANFIX_LEAD_TASK_FIELDS =
      "- id: 1\n  argName: env\n  type: number";
    const file = tmpFile(
      "leadTaskFields:\n  - id: 1\n    argName: file\n    type: number",
    );
    process.env.PLANFIX_CONFIG = file;
    const cfg = loadCustomFieldsConfig();
    expect(cfg.leadTaskFields[0].argName).toBe("file");
  });

  it("parses enum values", () => {
    const file = tmpFile(
      "contactFields:\n  - id: 2\n    argName: res\n    type: enum\n    values: [one, two]",
    );
    process.env.PLANFIX_CONFIG = file;
    const cfg = loadCustomFieldsConfig();
    expect(cfg.contactFields[0].values).toEqual(["one", "two"]);
  });

  it("loads chatApi from yaml", () => {
    const file = tmpFile(
      "chatApi:\n  chatApiToken: t\n  providerId: p\n  useChatApi: true\n  baseUrl: https://a.planfix.com/webchat/api",
    );
    process.env.PLANFIX_CONFIG = file;
    const cfg = loadCustomFieldsConfig();
    expect(cfg.chatApi).toEqual({
      chatApiToken: "t",
      providerId: "p",
      useChatApi: true,
      baseUrl: "https://a.planfix.com/webchat/api",
    });
  });

  it("loads proxyUrl from yaml", () => {
    const file = tmpFile("proxyUrl: http://localhost:8080");
    process.env.PLANFIX_CONFIG = file;

    const cfg = loadCustomFieldsConfig();

    expect(cfg.proxyUrl).toBe("http://localhost:8080");
  });

  it("chatApi defaults when missing", () => {
    const file = tmpFile("leadTaskFields: []\ncontactFields: []");
    process.env.PLANFIX_CONFIG = file;
    const cfg = loadCustomFieldsConfig();
    expect(cfg.chatApi).toEqual({
      chatApiToken: "",
      providerId: "",
      useChatApi: false,
      baseUrl: "",
    });
  });

  it("merges user fields from env and yaml", () => {
    process.env.PLANFIX_USER_FIELDS = "- id: 3\n  argName: env\n  type: string";
    const file = tmpFile(
      "userFields:\n  - id: 3\n    argName: file\n    type: string\n  - id: 4\n    argName: onlyFile\n    type: number",
    );
    process.env.PLANFIX_CONFIG = file;

    const cfg = loadCustomFieldsConfig();

    expect(cfg.userFields).toEqual([
      { id: 3, argName: "file", type: "string" },
      { id: 4, argName: "onlyFile", type: "number" },
    ]);
  });
});
