import { describe, expect, it } from "vitest";

import { canonicalizePatch, classifyPatchBucket } from "../../server/src/lib/riot/patchCanonical";

describe("patchCanonical", () => {
  it("canonicalizes legacy 2026 patches into 26.x", () => {
    expect(canonicalizePatch("16.6.604.8769", new Date("2026-03-01T00:00:00.000Z"))).toEqual({
      patchCanonical: "26.6",
      patchFormat: "legacy_patch",
    });
  });

  it("keeps year-based patches unchanged", () => {
    expect(canonicalizePatch("26.6.123.1", new Date("2026-03-01T00:00:00.000Z"))).toEqual({
      patchCanonical: "26.6",
      patchFormat: "year_patch",
    });
  });

  it("returns null for missing patches", () => {
    expect(canonicalizePatch(null, new Date("2026-03-01T00:00:00.000Z"))).toEqual({
      patchCanonical: null,
      patchFormat: "unknown",
    });
  });

  it("classifies canonical 26.x patches against policy prefixes", () => {
    const patch = canonicalizePatch("16.6.604.8769", new Date("2026-03-01T00:00:00.000Z")).patchCanonical;
    expect(classifyPatchBucket(patch, ["26."], ["26.6", "26.5", "26.4", "26.3", "26.2"])).toBe(
      "exact_target_patch",
    );
  });
});
