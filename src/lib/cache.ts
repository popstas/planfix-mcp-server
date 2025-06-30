import path from "path";
import DatabaseConstructor from "better-sqlite3";
import { debugLog } from "../helpers.js";

export interface CacheProvider {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  /** Delete cache records where key contains the prefix */
  deletePrefix?(prefix: string): Promise<void>;
  /** Delete all cache records */
  clear?(): Promise<void>;
}

export class SqliteCache implements CacheProvider {
  private db: ReturnType<typeof DatabaseConstructor>;
  constructor(dbPath: string) {
    this.db = new DatabaseConstructor(dbPath);
    debugLog(`[SqliteCache] db path: ${dbPath}`);
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, expiresAt INTEGER)",
    );
  }
  async get<T>(key: string): Promise<T | undefined> {
    const row = this.db
      .prepare("SELECT value, expiresAt FROM cache WHERE key=?")
      .get(key) as { value: string; expiresAt: number } | undefined;
    if (!row) {
      debugLog(`[SqliteCache] miss ${key}`);
      return undefined;
    }
    if (row.expiresAt && row.expiresAt < Date.now()) {
      this.db.prepare("DELETE FROM cache WHERE key=?").run(key);
      debugLog(`[SqliteCache] expired ${key}`);
      return undefined;
    }
    try {
      debugLog(`[SqliteCache] hit ${key}`);
      return JSON.parse(row.value) as T;
    } catch {
      debugLog(`[SqliteCache] failed to parse ${key}`);
      return undefined;
    }
  }
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    const expiresAt = Date.now() + ttl * 1000;
    const valueStr = JSON.stringify(value);
    debugLog(`[SqliteCache] set ${key}, ttl ${ttl}s`);
    this.db
      .prepare(
        "INSERT OR REPLACE INTO cache(key,value,expiresAt) VALUES(?,?,?)",
      )
      .run(key, valueStr, expiresAt);
  }

  async deletePrefix(prefix: string): Promise<void> {
    debugLog(`[SqliteCache] delete prefix ${prefix}`);
    this.db.prepare("DELETE FROM cache WHERE key LIKE ?").run(`%${prefix}%`);
  }

  async clear(): Promise<void> {
    debugLog(`[SqliteCache] clear all caches`);
    this.db.prepare("DELETE FROM cache").run();
  }
}

let provider: CacheProvider | undefined;
export function getCacheProvider(): CacheProvider {
  if (!provider) {
    const dbPath = path.join(process.cwd(), "data", "planfix-cache.sqlite3");
    debugLog(`[getCacheProvider] cache path: ${dbPath}`);
    provider = new SqliteCache(dbPath);
  }
  return provider;
}
