import { describe, expect, it } from "vitest";
import { filterToolNames } from "../../packages/mcp/src/policy.js";

describe("filterToolNames", () => {
  const names = ["a", "b", "c"] as const;

  it("treats allowTools: undefined as allow-all", () => {
    expect(filterToolNames(names, {})).toEqual(["a", "b", "c"]);
    expect(filterToolNames(names, { denyTools: ["b"] })).toEqual(["a", "c"]);
  });

  it("treats allowTools: [] as allow-none", () => {
    expect(filterToolNames(names, { allowTools: [] })).toEqual([]);
    expect(
      filterToolNames(names, { allowTools: [], denyTools: ["a"] }),
    ).toEqual([]);
  });

  it("filters by allowTools when present", () => {
    expect(filterToolNames(names, { allowTools: ["b"] })).toEqual(["b"]);
    expect(
      filterToolNames(names, { allowTools: ["b", "c"], denyTools: ["c"] }),
    ).toEqual(["b"]);
  });
});
