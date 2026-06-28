import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  buildEmailMatchList,
  dedupeAdditionalEmails,
} from "./emailFields.js";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeEmail("   ")).toBe("");
  });
});

describe("buildEmailMatchList", () => {
  it("puts primary first, then additional", () => {
    expect(buildEmailMatchList("a@x.com", ["b@x.com", "c@x.com"])).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
    ]);
  });

  it("normalizes and removes case-insensitive duplicates", () => {
    expect(
      buildEmailMatchList(" A@X.com ", ["a@x.COM", "B@x.com"]),
    ).toEqual(["a@x.com", "b@x.com"]);
  });

  it("drops empty and whitespace-only values", () => {
    expect(buildEmailMatchList("", ["", "   ", "b@x.com"])).toEqual([
      "b@x.com",
    ]);
  });

  it("handles missing arguments", () => {
    expect(buildEmailMatchList()).toEqual([]);
    expect(buildEmailMatchList("a@x.com")).toEqual(["a@x.com"]);
    expect(buildEmailMatchList(undefined, ["b@x.com"])).toEqual(["b@x.com"]);
  });
});

describe("dedupeAdditionalEmails", () => {
  it("normalizes, dedupes and drops empties", () => {
    expect(
      dedupeAdditionalEmails(undefined, [
        " B@X.com ",
        "b@x.com",
        "",
        "c@x.com",
      ]),
    ).toEqual(["b@x.com", "c@x.com"]);
  });

  it("excludes value equal to the primary (case-insensitive)", () => {
    expect(
      dedupeAdditionalEmails("Primary@X.com", ["primary@x.com", "b@x.com"]),
    ).toEqual(["b@x.com"]);
  });

  it("excludes values already present in existing", () => {
    expect(
      dedupeAdditionalEmails("a@x.com", ["b@x.com", "c@x.com"], [
        "B@x.com",
      ]),
    ).toEqual(["c@x.com"]);
  });

  it("returns empty array when nothing new", () => {
    expect(
      dedupeAdditionalEmails("a@x.com", ["a@x.com"], ["b@x.com"]),
    ).toEqual([]);
    expect(dedupeAdditionalEmails()).toEqual([]);
  });
});
