import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

const serverConnect = vi.fn();
vi.mock("./server.js", () => ({
  createPlanfixServer: () => ({ connect: serverConnect }),
}));

const transports: any[] = [];
class SSEServerTransportMockClass {
  sessionId: string;
  handlePostMessage = vi.fn();
  constructor(_endpoint: string, _res: any) {
    void _endpoint;
    void _res;
    this.sessionId = `id${transports.length}`;
    transports.push(this);
  }
}
const SSEServerTransportMock = vi.fn(
  (endpoint: string, res: any) =>
    new SSEServerTransportMockClass(endpoint, res),
);
vi.mock("@modelcontextprotocol/sdk/server/sse.js", () => ({
  SSEServerTransport: SSEServerTransportMock,
}));

let requestHandler: any;
const listenMock = vi.fn();
vi.mock("node:http", () => ({
  default: {
    createServer: vi.fn((handler: any) => {
      requestHandler = handler;
      return { listen: listenMock } as any;
    }),
  },
}));

vi.mock("./helpers.js", () => ({ log: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  transports.length = 0;
  listenMock.mockClear();
  SSEServerTransportMock.mockClear();
  serverConnect.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sse server", () => {
  it("handles connections and posts", async () => {
    await import("./sse-server.js");
    expect(listenMock).toHaveBeenCalled();

    const res = new EventEmitter() as any;
    res.on = EventEmitter.prototype.on;
    res.end = vi.fn();
    const req = { method: "GET", url: "/sse" } as any;
    await requestHandler(req, res);
    expect(SSEServerTransportMock).toHaveBeenCalledWith("/messages", res);
    expect(serverConnect).toHaveBeenCalledWith(transports[0]);

    const postRes = { end: vi.fn(), statusCode: 200 } as any;
    const postReq = new EventEmitter() as any;
    postReq.method = "POST";
    postReq.url = `/messages?sessionId=${transports[0].sessionId}`;
    await requestHandler(postReq, postRes);
    expect(transports[0].handlePostMessage).toHaveBeenCalledWith(
      postReq,
      postRes,
    );
  });

  it("returns 400 for unknown session", async () => {
    await import("./sse-server.js");
    const res = { end: vi.fn(), statusCode: undefined } as any;
    const req = { method: "POST", url: "/messages?sessionId=unknown" } as any;
    await requestHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.end).toHaveBeenCalledWith("No transport found for sessionId");
  });
});
