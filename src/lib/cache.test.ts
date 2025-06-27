import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { SqliteCache } from "./cache.js";

function tmpDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cache-"));
  return path.join(dir, "test.sqlite");
}

describe("SqliteCache", () => {
  let dbPath: string;
  beforeEach(() => {
    dbPath = tmpDb();
  });

  it("stores and retrieves values", async () => {
    const cache = new SqliteCache(dbPath);
    await cache.set("key", { a: 1 });
    const result = await cache.get<{ a: number }>("key");
    expect(result).toEqual({ a: 1 });
  });

  it("returns undefined for expired values", async () => {
    const cache = new SqliteCache(dbPath);
    await cache.set("exp", "v", 1);
    await new Promise((r) => setTimeout(r, 1100));
    const result = await cache.get("exp");
    expect(result).toBeUndefined();
  });

  it("handles unparsable JSON gracefully", async () => {
    const cache = new SqliteCache(dbPath);
    // insert invalid json directly
    const db: any = (cache as any).db;
    db.prepare(
      "INSERT OR REPLACE INTO cache(key,value,expiresAt) VALUES(?,?,?)",
    ).run("bad", "notjson", Date.now() + 1000);
    const result = await cache.get("bad");
    expect(result).toBeUndefined();
  });
});
