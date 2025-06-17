import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import yaml from "js-yaml";
import { planfixClient } from "./planfix-client.js";
import { log } from "../helpers.js";

export interface PlanfixObject {
  id: number;
  name: string;
  [key: string]: unknown;
}

const CACHE_FILE_NAME = "planfix-objects.yml";
const DATA_CACHE_FILE_NAME = "planfix-cache.yml";
const CACHE_MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days in ms

function getDefaultCachePath(): string {
  const dataDir = path.join(process.cwd(), "data");
  if (fs.existsSync(dataDir) && fs.statSync(dataDir).isDirectory()) {
    return path.join(dataDir, DATA_CACHE_FILE_NAME);
  }
  return path.join(os.tmpdir(), CACHE_FILE_NAME);
}

async function writeCache(
  data: Record<string, PlanfixObject>,
  cachePath: string,
) {
  await fsp.writeFile(cachePath, yaml.dump(data), "utf-8");
}

async function readCache(
  cachePath: string,
): Promise<Record<string, PlanfixObject>> {
  const content = await fsp.readFile(cachePath, "utf-8");
  return (yaml.load(content) as Record<string, PlanfixObject>) || {};
}

async function fetchObjects(): Promise<Record<string, PlanfixObject>> {
  const list = (await planfixClient.post<{ objects?: { id: number }[] }>(
    "object/list",
  )) as { objects?: { id: number }[] };
  const result: Record<string, PlanfixObject> = {};
  for (const item of list.objects || []) {
    const details = (await planfixClient.get<{ object: PlanfixObject }>(
      `object/${item.id}`,
    )) as { object: PlanfixObject };
    result[details.object.name] = details.object;
  }
  return result;
}

async function updateCache(cachePath: string) {
  const started = Date.now();
  const data = await fetchObjects();
  await writeCache(data, cachePath);
  const duration = Math.round((Date.now() - started) / 1000);
  log(`[planfixObjects] Cache updated: ${cachePath} (${duration}s)`);
  return data;
}

async function ensureCache(
  cachePath: string = getDefaultCachePath(),
): Promise<Record<string, PlanfixObject>> {
  try {
    const stats = fs.existsSync(cachePath) ? fs.statSync(cachePath) : null;
    if (stats) {
      const age = Date.now() - stats.mtimeMs;
      const cached = await readCache(cachePath);
      if (age > CACHE_MAX_AGE) {
        log(
          `[planfixObjects] Cache outdated, updating in background: ${cachePath}`,
        );
        updateCache(cachePath).catch((e) =>
          log(
            `[planfixObjects] Background update failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      }
      return cached;
    }
  } catch (e) {
    log(
      `[planfixObjects] Failed to read cache: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return updateCache(cachePath);
}

export async function getObjects(cachePath: string = getDefaultCachePath()) {
  return ensureCache(cachePath);
}

export async function getObjectsNames(
  cachePath: string = getDefaultCachePath(),
): Promise<string[]> {
  const objects = await ensureCache(cachePath);
  return Object.values(objects).map((o) => o.name);
}

export async function getFieldDirectoryId({
  objectName,
  objectId,
  fieldName,
  fieldId,
  cachePath,
}: {
  objectName?: string;
  objectId?: number;
  fieldName?: string;
  fieldId?: number;
  cachePath?: string;
}): Promise<number | undefined> {
  const objects = await ensureCache(cachePath);
  const obj = objectName
    ? objects[objectName]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    : Object.entries(objects).find(([_, o]) => o.id === objectId)?.[1];
  if (!obj) return undefined;
  interface CustomField {
    field: { name: string; directoryId?: number; id?: number };
  }
  let field: CustomField | undefined;
  if (fieldId) {
    field = (obj as { customFieldData?: CustomField[] }).customFieldData?.find(
      (f) => f.field.id === fieldId,
    );
  } else {
    field = (obj as { customFieldData?: CustomField[] }).customFieldData?.find(
      (f) => f.field.name === fieldName,
    );
  }
  return field?.field.directoryId;
}
