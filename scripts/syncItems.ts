import { riotSyncService } from "../server/src/services/riotSyncService.js";

riotSyncService
  .syncItems()
  .then((result) => {
    console.log(`Synced ${result.count} items for patch ${result.version}.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
