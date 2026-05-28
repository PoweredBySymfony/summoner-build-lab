import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("ImportedMatch indexes", () => {
  it("keeps the indexes needed by the ingestion and reporting queries", () => {
    const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
    const schema = fs.readFileSync(schemaPath, "utf8");

    expect(schema).toContain('@@index([riotMatchId])');
    expect(schema).toContain('@@index([patch])');
    expect(schema).toContain('@@index([sourceRegion])');
    expect(schema).toContain('@@index([targetPuuid])');
    expect(schema).toContain('@@index([gameCreationAt])');
  });
});
