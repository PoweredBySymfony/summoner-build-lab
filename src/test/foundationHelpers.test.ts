import { describe, expect, it, vi } from "vitest";

import { cn } from "@/lib/utils";
import { getLocalized } from "@/lib/formatters/localized";
import { parseJsonField } from "@/pages/admin/parseJsonField";
import { groupBy } from "../../server/src/services/groupBy";
import { asyncRoute } from "../../server/src/utils/asyncRoute";
import { HttpError, isRecord } from "../../server/src/utils/http";
import { toLocalized } from "../../server/src/utils/localized";

describe("foundation helpers", () => {
  it("merges class names and resolves localized values", () => {
    const hiddenClass = false;

    expect(cn("px-2", hiddenClass ? "hidden" : null, "px-4")).toBe("px-4");

    expect(getLocalized({ fr: "Bonjour", en: "Hello" }, "fr")).toBe("Bonjour");
    expect(getLocalized({ en: "Hello" } as never, "fr")).toBe("Hello");
    expect(getLocalized(undefined, "fr")).toBe("");

    expect(toLocalized({ fr: "Oui", en: "Yes" })).toEqual({ fr: "Oui", en: "Yes" });
    expect(toLocalized("Same")).toEqual({ fr: "Same", en: "Same" });
    expect(toLocalized(null)).toEqual({ fr: "", en: "" });
  });

  it("parses JSON admin fields and groups values by derived key", () => {
    expect(parseJsonField("", { fallback: true })).toEqual({ fallback: true });
    expect(parseJsonField('{"enabled":true}', { enabled: false })).toEqual({ enabled: true });

    expect(
      groupBy(
        [
          { role: "ADC", name: "Jinx" },
          { role: "ADC", name: "Kai'Sa" },
          { role: "MID", name: "Ahri" },
        ],
        (entry) => entry.role,
      ),
    ).toEqual({
      ADC: [
        { role: "ADC", name: "Jinx" },
        { role: "ADC", name: "Kai'Sa" },
      ],
      MID: [{ role: "MID", name: "Ahri" }],
    });
  });

  it("wraps async route failures and identifies record-like values", async () => {
    const next = vi.fn();
    const handler = asyncRoute(async () => {
      throw new Error("boom");
    });

    handler({} as never, {} as never, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
    expect(isRecord({ ok: true })).toBe(true);
    expect(isRecord(["no"])).toBe(false);
    expect(isRecord(null)).toBe(false);

    const error = new HttpError(418, "teapot", { code: "short-and-stout" });
    expect(error.status).toBe(418);
    expect(error.details).toEqual({ code: "short-and-stout" });
  });
});
