import { riotSyncService } from "../server/src/services/riotSyncService.js";

riotSyncService
  .syncAssets()
  .then((result) => {
    console.log(`Refreshed ${result.championCount} champion assets and ${result.itemCount} item assets for ${result.version}.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
