#!/usr/bin/env node
import { planfixClient } from "../lib/planfix-client.js";
import { Command } from "commander";
import path from "path";
import fs from "fs";

// Load environment variables from .env file
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...value] = line.split("=");
    if (key && value.length > 0) {
      process.env[key.trim()] = value
        .join("=")
        .replace(/(^['"]|['"]$)/g, "")
        .trim();
    }
  });
}

const program = new Command();

program.name("planfix-cli").description("CLI for Planfix API").version("1.0.0");

// GET command
program
  .command("get <path>")
  .description("Make a GET request to Planfix API")
  .option("-p, --params <params>", "Query parameters as JSON string")
  .action(async (path, options) => {
    try {
      const params = options.params ? JSON.parse(options.params) : undefined;
      const result = await planfixClient.get(path, params);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : "Unknown error",
      );
      process.exit(1);
    }
  });

// POST command
program
  .command("post <path>")
  .description("Make a POST request to Planfix API")
  .option("-d, --data <data>", "Request body as JSON string")
  .option("--body-file <file>", "Path to JSON file containing request body")
  .action(async (path, options) => {
    try {
      let data;
      if (options.bodyFile) {
        const fileContent = fs.readFileSync(options.bodyFile, "utf8");
        data = JSON.parse(fileContent);
      } else if (options.data) {
        data = JSON.parse(options.data);
      }
      const result = await planfixClient.post(path, data);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : "Unknown error",
      );
      process.exit(1);
    }
  });

// PUT command
program
  .command("put <path>")
  .description("Make a PUT request to Planfix API")
  .option("-d, --data <data>", "Request body as JSON string")
  .action(async (path, options) => {
    try {
      const data = options.data ? JSON.parse(options.data) : undefined;
      const result = await planfixClient.put(path, data);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : "Unknown error",
      );
      process.exit(1);
    }
  });

// DELETE command
program
  .command("delete <path>")
  .description("Make a DELETE request to Planfix API")
  .option("-d, --data <data>", "Request body as JSON string")
  .action(async (path, options) => {
    try {
      const data = options.data ? JSON.parse(options.data) : undefined;
      const result = await planfixClient.delete(path, data);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : "Unknown error",
      );
      process.exit(1);
    }
  });

// Test command
program
  .command("test")
  .description("Test Planfix API connection")
  .action(async () => {
    try {
      console.log("Testing Planfix API connection...");
      const result = await planfixClient.get("user/current");
      console.log("Success! Current user:", JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(
        "Connection test failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
      process.exit(1);
    }
  });

// Show help if no arguments
if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);
