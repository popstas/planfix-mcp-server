import { describe, expect, it } from "vitest";
import { isExactNameMatch } from "./nameMatch.js";

describe("isExactNameMatch", () => {
  it.each([
    ["US Media", { name: "Status Media" }, false],
    ["СМИ США", { name: "СМИ", lastname: "США" }, true],
    ["Иванов Иван", { name: "Иван", lastname: "Иванов" }, true],
    ["Алёна Петрова", { name: "алена", lastname: "петрова" }, true],
    [
      "Иван Петров",
      { name: "Иван", midname: "Сергеевич", lastname: "Петров" },
      false,
    ],
    ["  ", { name: "" }, false],
  ])("%s vs %j -> %s", (query, contact, expected) => {
    expect(isExactNameMatch(query, contact)).toBe(expected);
  });
});
