import { riotSyncService } from "../server/src/services/riotSyncService.js";

riotSyncService
  .syncAll()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
