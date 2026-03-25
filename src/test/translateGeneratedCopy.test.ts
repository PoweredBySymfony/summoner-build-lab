import { describe, expect, it } from "vitest";
import { translateGeneratedCopy } from "../../server/src/services/viewMappers";

describe("translateGeneratedCopy", () => {
  it("translates legacy english generated copy into french", () => {
    expect(translateGeneratedCopy("What is the best next item purchase on Ahri in this situation?")).toBe(
      "Quel est le meilleur prochain achat sur Ahri dans cette situation ?",
    );
    expect(translateGeneratedCopy("Generated from champion-focused OTP heuristics.")).toBe(
      "Genere a partir des heuristiques OTP centrees sur le champion.",
    );
  });

  it("repairs common mojibake artifacts", () => {
    expect(translateGeneratedCopy("SÃ©rie OTP Aatrox: pression")).toBe("Série OTP Aatrox: pression");
    expect(translateGeneratedCopy("rÃ©sistance magique")).toBe("résistance magique");
  });
});
