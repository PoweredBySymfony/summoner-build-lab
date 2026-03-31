import { describe, expect, it } from "vitest";

import { extractRiotIdCandidates } from "../../server/src/lib/riot/proSeeds";

describe("proSeeds", () => {
  it("extracts normalized Riot ID candidates from Leaguepedia soloqueue markup", () => {
    const candidates = extractRiotIdCandidates(
      "'''KR:''' ice seven zero#0721 &lt;br&gt; '''NA:''' icecream#WTG4",
    );

    expect(candidates).toEqual([
      {
        riotId: "ice seven zero#0721",
        platformHint: "kr",
        cluster: "asia",
      },
      {
        riotId: "icecream#WTG4",
        platformHint: "na1",
        cluster: "americas",
      },
    ]);
  });

  it("ignores soloqueue aliases that are not valid Riot IDs", () => {
    const candidates = extractRiotIdCandidates(
      "'''EUW:''' junjiazhi, Berlin Saint-Germain &lt;br&gt; '''CN:''' haohaohao",
    );

    expect(candidates).toEqual([]);
  });
});
