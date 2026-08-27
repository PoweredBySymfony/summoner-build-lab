# Proxmox Native Data Services

This project should use a stable Proxmox CT for native PostgreSQL and MongoDB services. The GitHub runner can then use fixed LAN URLs, and Windows IP changes no longer break CI.

## Target Layout

- SonarQube server: `192.168.1.17`
- GitHub runner: `192.168.1.19`
- New data CT: choose a static IP, for example `192.168.1.18`
- PostgreSQL native service: port `5432`
- MongoDB native service: port `27017`
- ML API native Python service: port `8001`
- mongo-express native Node service: port `8081`
- pgAdmin web through Apache: `http://<CT_IP>/pgadmin4/`

Use a static DHCP lease in your router or configure a fixed IP in Proxmox. The important point is that the runner, SonarQube if needed, and your Windows machine can reach the CT IP.

## 1. Create The CT

Recommended baseline:

- Ubuntu 26.04 LTS
- 2 vCPU
- 4 GB RAM
- 30 GB disk minimum, more if Mongo stores many match imports
- Unprivileged CT is fine for native services
- No Docker nesting required

From the Proxmox host:

```bash
pct start <CT_ID>
pct enter <CT_ID>
```

## 2. Bootstrap Native PostgreSQL And MongoDB

Copy the repo, or at least `infra/proxmox/data-services/bootstrap-ct-native.sh`, into the CT.

If you copy only the script, set `APP_REPO_URL` so the script can clone the project code needed by the ML API:

```bash
APP_REPO_URL=https://github.com/<owner>/<repo>.git ./bootstrap-ct-native.sh
```

If you copy the whole repo and run the script from inside it, `APP_REPO_URL` is not required.

Then run as root:

```bash
chmod +x bootstrap-ct-native.sh
./bootstrap-ct-native.sh
```

Defaults:

```text
POSTGRES_DB=summoner_build_lab
POSTGRES_USER=summoner
POSTGRES_ALLOWED_CIDR=192.168.1.0/24
MONGO_DB=summoner_build_lab
MONGO_BIND_IP=0.0.0.0
MONGODB_MAJOR=8.0
INSTALL_ML_API=true
ML_API_PORT=8001
INSTALL_MONGO_EXPRESS=true
MONGO_EXPRESS_PORT=8081
INSTALL_PGADMIN=true
PGADMIN_EMAIL=admin@summoner-build-lab.local
```

For Ubuntu 26.04, the script accepts `resolute`. If the MongoDB apt repository for `resolute` is not published yet, it uses MongoDB 8.0 packages from Ubuntu 24.04 `noble` by default. Later, when MongoDB publishes `resolute`, run with:

```bash
MONGODB_REPO_CODENAME=resolute ./bootstrap-ct-native.sh
```

Same idea for pgAdmin:

```bash
PGADMIN_REPO_CODENAME=resolute ./bootstrap-ct-native.sh
```

For a different LAN range:

```bash
POSTGRES_ALLOWED_CIDR=192.168.0.0/16 ./bootstrap-ct-native.sh
```

The script writes:

- `/opt/summoner-build-lab-data/db.env`
- `/etc/systemd/system/summoner-ml-api.service`
- `/etc/systemd/system/mongo-express.service`
- `/usr/local/bin/summoner-db-backup`
- `/usr/local/bin/summoner-db-restore`
- a daily backup timer at `03:15`

Read the generated PostgreSQL and pgAdmin passwords:

```bash
cat /opt/summoner-build-lab-data/db.env
```

## 3. Backup Current Windows Docker Databases

Run this from PowerShell on Windows, where Docker Desktop currently hosts the old containers:

```powershell
$backup = "$PWD\backups\$(Get-Date -Format yyyyMMdd-HHmmss)"
New-Item -ItemType Directory -Force $backup | Out-Null

docker exec summoner-build-lab-postgres pg_dump `
  -U postgres `
  -d summoner_build_lab `
  --format=custom `
  --file=/tmp/postgres.dump

docker cp summoner-build-lab-postgres:/tmp/postgres.dump "$backup\postgres.dump"

docker exec summoner-build-lab-mongo mongodump `
  --db summoner_build_lab `
  --archive=/tmp/mongo.archive `
  --gzip

docker cp summoner-build-lab-mongo:/tmp/mongo.archive "$backup\mongo.archive"
```

The ML container mounts local folders from the repo, so also keep a copy of these if they contain trained models or datasets:

```powershell
Copy-Item -Recurse -Force .\ml\artifacts "$backup\ml-artifacts"
Copy-Item -Recurse -Force .\ml\data "$backup\ml-data"
```

If your Windows containers have different names:

```powershell
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
```

## 4. Copy Backup To The CT

From Windows PowerShell:

```powershell
scp -r .\backups\<YYYYMMDD-HHMMSS> root@<CT_IP>:/opt/summoner-build-lab-data/backups/
```

Example:

```powershell
scp -r .\backups\20260612-143000 root@192.168.1.18:/opt/summoner-build-lab-data/backups/
```

## 5. Restore Into Native Services

Inside the CT:

```bash
summoner-db-restore /opt/summoner-build-lab-data/backups/<YYYYMMDD-HHMMSS>
```

If you backed up ML artifacts and data, copy them into the deployed app source:

```bash
rsync -a /opt/summoner-build-lab-data/backups/<YYYYMMDD-HHMMSS>/ml-artifacts/ /opt/summoner-build-lab-app/ml/artifacts/
rsync -a /opt/summoner-build-lab-data/backups/<YYYYMMDD-HHMMSS>/ml-data/ /opt/summoner-build-lab-app/ml/data/
chown -R summoner-ml:summoner-ml /opt/summoner-build-lab-app/ml/artifacts /opt/summoner-build-lab-app/ml/data
systemctl restart summoner-ml-api
```

Then verify:

```bash
source /opt/summoner-build-lab-data/db.env
PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\dt'
mongosh 127.0.0.1/"$MONGO_DB" --quiet --eval 'db.getCollectionNames()'
curl -f http://127.0.0.1:8001/health
```

## 6. Point GitHub Actions To The CT

In GitHub repository settings, set Actions secrets or variables:

```text
CI_DATABASE_URL=postgresql://summoner:<POSTGRES_PASSWORD>@<CT_IP>:5432/summoner_build_lab?schema=public
CI_MONGODB_URI=mongodb://<CT_IP>:27017/summoner_build_lab
SONAR_HOST_URL=http://192.168.1.17:9000
SONAR_TOKEN=<sonarqube-token>
```

## 7. Point Local Development To The CT

In your local `.env`, use:

```text
DATABASE_URL=postgresql://summoner:<POSTGRES_PASSWORD>@<CT_IP>:5432/summoner_build_lab?schema=public
MONGODB_URI=mongodb://<CT_IP>:27017/summoner_build_lab
MONGODB_DB_NAME=summoner_build_lab
ML_API_URL=http://<CT_IP>:8001
ML_ENABLED=true
```

Keep the old Docker Desktop volumes until you have verified that imported match data exists in the CT.

## Useful CT Commands

```bash
systemctl status postgresql
systemctl status mongod
systemctl status summoner-ml-api
systemctl status mongo-express
systemctl status apache2
journalctl -u postgresql -n 100 --no-pager
journalctl -u mongod -n 100 --no-pager
journalctl -u summoner-ml-api -n 100 --no-pager
journalctl -u mongo-express -n 100 --no-pager
summoner-db-backup
systemctl status summoner-db-backup.timer
ls -lah /opt/summoner-build-lab-data/backups
```

## Connectivity Checks

From the runner at `192.168.1.19`:

```bash
nc -vz <CT_IP> 5432
nc -vz <CT_IP> 27017
curl -f http://<CT_IP>:8001/health
curl -f http://<CT_IP>:8081/
curl -f http://<CT_IP>/pgadmin4/
curl -f http://192.168.1.17:9000/api/system/status
```

If these fail, fix the CT IP, LAN routing, or firewall before debugging Prisma, MongoDB, or SonarQube.
