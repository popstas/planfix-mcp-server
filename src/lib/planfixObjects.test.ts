import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import yaml from "js-yaml";
import {
  getObjects,
  getObjectsNames,
  getFieldDirectoryId,
} from "./planfixObjects.js";

function tmpCache(data: any): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pfo-"));
  const file = path.join(dir, "cache.yml");
  fs.writeFileSync(file, yaml.dump(data));
  return file;
}

describe("planfixObjects", () => {
  it("returns objects from cache", async () => {
    const objects = { Contact: { id: 1, name: "Contact" } };
    const cache = tmpCache(objects);
    const result = await getObjects(cache);
    expect(result).toEqual(objects);
  });

  it("gets object names", async () => {
    const cache = tmpCache({
      A: { id: 1, name: "A" },
      B: { id: 2, name: "B" },
    });
    const names = await getObjectsNames(cache);
    expect(names).toEqual(expect.arrayContaining(["A", "B"]));
  });

  it("gets directory id by object and field names", async () => {
    const cache = tmpCache({
      Obj: {
        id: 1,
        name: "Obj",
        customFieldData: [
          { field: { name: "Field", directoryId: 777, id: 5 } },
        ],
      },
    });
    const id = await getFieldDirectoryId({
      objectName: "Obj",
      fieldName: "Field",
      cachePath: cache,
    });
    expect(id).toBe(777);
  });

  it("falls back to object id", async () => {
    const cache = tmpCache({
      Obj: {
        id: 42,
        name: "Obj",
        customFieldData: [
          { field: { id: 5, directoryId: 333, name: "Other" } },
        ],
      },
    });
    const id = await getFieldDirectoryId({
      objectId: 42,
      fieldId: 5,
      cachePath: cache,
    });
    expect(id).toBe(333);
  });
});
