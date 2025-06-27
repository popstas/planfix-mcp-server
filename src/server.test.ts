import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./helpers.js", async () => {
  const actual =
    await vi.importActual<typeof import("./helpers.js")>("./helpers.js");
  return {
    ...actual,
    log: vi.fn(),
  };
});

const setRequestHandler = vi.fn();
const ServerMock = vi.fn().mockImplementation(() => ({
  setRequestHandler,
}));

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: ServerMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPlanfixServer", () => {
  it("registers request handlers", async () => {
    const { createPlanfixServer, TOOLS } = await import("./server.js");
    const server = createPlanfixServer();
    expect(server).toBeDefined();
    expect(ServerMock).toHaveBeenCalled();
    expect(setRequestHandler).toHaveBeenCalledTimes(2);

    const listHandler = setRequestHandler.mock.calls[0][1];
    await expect(listHandler()).resolves.toEqual({ tools: TOOLS });

    const callHandler = setRequestHandler.mock.calls[1][1];
    const tool = { name: "t", handler: vi.fn(async () => "ok") };
    (TOOLS as any).push(tool);
    const result = await callHandler({ params: { name: "t", arguments: {} } });
    expect(result.structuredContent).toBe("ok");
  });
});
