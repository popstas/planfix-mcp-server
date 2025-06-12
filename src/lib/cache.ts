import path from "path";
import DatabaseConstructor from "better-sqlite3";

export interface CacheProvider {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
}

export class SqliteCache implements CacheProvider {
  private db: any;
  constructor(dbPath: string) {
    this.db = new DatabaseConstructor(dbPath);
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, expiresAt INTEGER)",
    );
  }
  async get<T>(key: string): Promise<T | undefined> {
    const row = this.db
      .prepare("SELECT value, expiresAt FROM cache WHERE key=?")
      .get(key) as { value: string; expiresAt: number } | undefined;
    if (!row) return undefined;
    if (row.expiresAt && row.expiresAt < Date.now()) {
      this.db.prepare("DELETE FROM cache WHERE key=?").run(key);
      return undefined;
    }
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return undefined;
    }
  }
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    const expiresAt = Date.now() + ttl * 1000;
    const valueStr = JSON.stringify(value);
    this.db
      .prepare(
        "INSERT OR REPLACE INTO cache(key,value,expiresAt) VALUES(?,?,?)",
      )
      .run(key, valueStr, expiresAt);
  }
}

let provider: CacheProvider | undefined;
export function getCacheProvider(): CacheProvider {
  if (!provider) {
    const dbPath = path.join(process.cwd(), "data", "planfix-cache.sqlite3");
    provider = new SqliteCache(dbPath);
  }
  return provider;
}
