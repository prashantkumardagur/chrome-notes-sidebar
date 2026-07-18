import { describe, expect, it } from "vitest";
import { EMPTY_SEARCH_STATE, normalizeSearchState } from "../../src/lib/search/searchState";

describe("normalizeSearchState", () => {
  it("returns the empty state for undefined", () => {
    expect(normalizeSearchState(undefined)).toEqual(EMPTY_SEARCH_STATE);
  });

  it("passes through a valid state", () => {
    const state = { active: true, query: "todo", collapsed: ["a", "b"] };
    expect(normalizeSearchState(state)).toEqual(state);
  });

  it("coerces missing/corrupt fields to safe defaults", () => {
    expect(normalizeSearchState({ query: "x" } as never)).toEqual({
      active: false,
      query: "x",
      collapsed: [],
    });
    // Non-array collapsed and wrong-typed fields are dropped.
    expect(normalizeSearchState({ active: "yes", query: 42, collapsed: "nope" } as never)).toEqual(EMPTY_SEARCH_STATE);
    // Non-string ids are filtered out of collapsed.
    expect(normalizeSearchState({ collapsed: ["a", 1, null, "b"] } as never).collapsed).toEqual(["a", "b"]);
  });
});
