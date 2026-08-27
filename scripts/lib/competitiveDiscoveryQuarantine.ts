import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type CompetitiveDiscoveryQuarantineEntry = {
  reason: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  quarantinedAt: string;
};

export type CompetitiveDiscoveryQuarantine = {
  version: 1;
  generatedAt: string;
  seedSetVersion: string;
  seedKeys: Record<string, CompetitiveDiscoveryQuarantineEntry>;
  regions: Record<string, CompetitiveDiscoveryQuarantineEntry>;
};

export async function loadDiscoveryQuarantine(quarantinePath: string, seedSetVersion: string) {
  try {
    const raw = (await readFile(quarantinePath, "utf-8")).replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw) as CompetitiveDiscoveryQuarantine;
    if (parsed.seedSetVersion !== seedSetVersion || parsed.version !== 1) {
      return null;
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function saveDiscoveryQuarantine(
  quarantinePath: string,
  quarantine: CompetitiveDiscoveryQuarantine,
) {
  await mkdir(path.dirname(quarantinePath), { recursive: true });
  await writeFile(quarantinePath, JSON.stringify(quarantine, null, 2), "utf-8");
}
