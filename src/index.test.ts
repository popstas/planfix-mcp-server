import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const connectMock = vi.fn().mockResolvedValue(undefined);
const closeMock = vi.fn().mockResolvedValue(undefined);

vi.mock("./server.js", () => ({
  createPlanfixServer: vi.fn(() => ({
    connect: connectMock,
    close: closeMock,
  })),
}));

const StdioTransportMock = vi.fn();
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: StdioTransportMock,
}));

vi.mock("./helpers.js", () => ({ log: vi.fn() }));

let exitSpy: any;
let onSpy: any;

beforeEach(() => {
  vi.resetModules();
  connectMock.mockClear();
  closeMock.mockClear();
  StdioTransportMock.mockClear();
  exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("exit");
  });
  onSpy = vi.spyOn(process, "on");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("index entry", () => {
  it("starts server and handles SIGINT", async () => {
    try {
      await import("./index.js");
    } catch (e) {
      if ((e as Error).message !== "exit") throw e;
    }

    expect(StdioTransportMock).toHaveBeenCalled();
    expect(connectMock).toHaveBeenCalled();
    const sigHandler = onSpy.mock.calls.find(
      (c: any) => c[0] === "SIGINT",
    )?.[1];
    expect(sigHandler).toBeTypeOf("function");
    await expect(sigHandler()).rejects.toThrow("exit");
    expect(closeMock).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
