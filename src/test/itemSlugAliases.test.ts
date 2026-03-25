import { describe, expect, it } from "vitest";
import { resolveItemSlug } from "../../server/src/lib/itemSlugAliases";

describe("resolveItemSlug", () => {
  it("maps known english item slugs to localized database slugs", () => {
    expect(resolveItemSlug("plated-steelcaps")).toBe("coques-en-acier");
    expect(resolveItemSlug("spirit-visage")).toBe("visage-spirituel");
    expect(resolveItemSlug("ludens-companion")).toBe("echo-de-luden");
    expect(resolveItemSlug("mortal-reminder")).toBe("rappel-mortel");
    expect(resolveItemSlug("null-magic-mantle")).toBe("cape-de-neant");
  });

  it("leaves already localized or unknown slugs unchanged", () => {
    expect(resolveItemSlug("coques-en-acier")).toBe("coques-en-acier");
    expect(resolveItemSlug("objet-inconnu")).toBe("objet-inconnu");
  });
});
