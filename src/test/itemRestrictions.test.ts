import { describe, expect, it } from "vitest";
import { filterRestrictedItems, getItemRestrictionDecision } from "../../server/src/lib/itemRestrictions";

describe("item restrictions", () => {
  it("blocks ADC-restricted tier 3 boots on the configured patch", () => {
    expect(getItemRestrictionDecision("lucidite-pourpre", { patch: "16.6.1", role: "ADC" })).toEqual({
      allowed: false,
      reasons: ["role-restricted"],
    });
  });

  it("keeps MID override access on the same patch", () => {
    expect(getItemRestrictionDecision("lucidite-pourpre", { patch: "16.6.1", role: "MID" })).toEqual({
      allowed: true,
      reasons: [],
    });
  });

  it("applies patch blacklists independently from role", () => {
    expect(getItemRestrictionDecision("jarvan-i", { patch: "16.6", role: "TOP" })).toEqual({
      allowed: false,
      reasons: ["patch-restricted"],
    });
  });

  it("filters mixed candidate lists with explicit reasons", () => {
    const result = filterRestrictedItems(
      [
        { slug: "lucidite-pourpre" },
        { slug: "jarvan-i" },
        { slug: "lame-dinfini" },
      ],
      { patch: "16.6", role: "ADC" },
    );

    expect(result.allowedItems.map((item) => item.slug)).toEqual(["lame-dinfini"]);
    expect(result.rejectedItems).toEqual([
      { item: { slug: "lucidite-pourpre" }, reasons: ["role-restricted"] },
      { item: { slug: "jarvan-i" }, reasons: ["patch-restricted"] },
    ]);
  });
});
