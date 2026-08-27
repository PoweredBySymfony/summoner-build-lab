import { riotSyncService } from "../server/src/services/riotSyncService.js";

try {
  const result = await riotSyncService.syncAll();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
