#!/usr/bin/env node
import http from "node:http";
import { URL } from "node:url";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createPlanfixServer } from "./server.js";
import { log } from "./helpers.js";

log("Starting Planfix MCP Server (SSE mode)");

const server = createPlanfixServer();
const transports: Record<string, SSEServerTransport> = {};

const httpServer = http.createServer(async (req, res) => {
  if (!req.url) return res.end();
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/sse") {
    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;
    res.on("close", () => {
      delete transports[transport.sessionId];
    });
    await server.connect(transport);
  } else if (req.method === "POST" && url.pathname === "/messages") {
    const sessionId = url.searchParams.get("sessionId") || "";
    const transport = transports[sessionId];
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.statusCode = 400;
      res.end("No transport found for sessionId");
    }
  } else {
    res.statusCode = 404;
    res.end();
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
httpServer.listen(port, () => {
  console.log(`SSE server listening on port ${port}`);
});
