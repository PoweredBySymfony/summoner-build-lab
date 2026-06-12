#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="summoner-build-lab"
BASE_DIR="/opt/${APP_NAME}-data"
BACKUP_DIR="${BASE_DIR}/backups"
ENV_FILE="${BASE_DIR}/db.env"
BIN_DIR="/usr/local/bin"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

POSTGRES_DB="${POSTGRES_DB:-summoner_build_lab}"
POSTGRES_USER="${POSTGRES_USER:-summoner}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
POSTGRES_LISTEN_ADDRESS="${POSTGRES_LISTEN_ADDRESS:-*}"
POSTGRES_ALLOWED_CIDR="${POSTGRES_ALLOWED_CIDR:-192.168.1.0/24}"

MONGO_DB="${MONGO_DB:-summoner_build_lab}"
MONGO_BIND_IP="${MONGO_BIND_IP:-0.0.0.0}"
MONGODB_MAJOR="${MONGODB_MAJOR:-8.0}"
MONGODB_REPO_CODENAME="${MONGODB_REPO_CODENAME:-}"

INSTALL_ML_API="${INSTALL_ML_API:-true}"
APP_REPO_URL="${APP_REPO_URL:-}"
APP_SOURCE_DIR="${APP_SOURCE_DIR:-/opt/summoner-build-lab-app}"
ML_API_PORT="${ML_API_PORT:-8001}"
ML_SERVICE_USER="${ML_SERVICE_USER:-summoner-ml}"
ML_PYTHON_VERSION="${ML_PYTHON_VERSION:-3.13}"
ML_VENV_DIR="${ML_VENV_DIR:-/opt/summoner-build-lab-ml-venv}"
UV_PYTHON_INSTALL_DIR="${UV_PYTHON_INSTALL_DIR:-/opt/uv-python}"

INSTALL_MONGO_EXPRESS="${INSTALL_MONGO_EXPRESS:-true}"
MONGO_EXPRESS_DIR="${MONGO_EXPRESS_DIR:-/opt/mongo-express}"
MONGO_EXPRESS_PORT="${MONGO_EXPRESS_PORT:-8081}"
MONGO_EXPRESS_VERSION="${MONGO_EXPRESS_VERSION:-1.0.0}"

INSTALL_PGADMIN="${INSTALL_PGADMIN:-true}"
PGADMIN_EMAIL="${PGADMIN_EMAIL:-admin@summoner-build-lab.local}"
PGADMIN_PASSWORD="${PGADMIN_PASSWORD:-}"
PGADMIN_REPO_CODENAME="${PGADMIN_REPO_CODENAME:-}"

log_info() {
  printf '[%s] INFO: %s\n' "$(date -Is)" "$*" >&2
}

log_warn() {
  printf '[%s] WARN: %s\n' "$(date -Is)" "$*" >&2
}

log_error() {
  printf '[%s] ERROR: %s\n' "$(date -Is)" "$*" >&2
}

die() {
  log_error "$*"
  exit 1
}

on_error() {
  local exit_code="$?"
  log_error "Failed on line ${BASH_LINENO[0]} with exit code ${exit_code}."
  exit "$exit_code"
}

trap on_error ERR

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "Run this script as root inside the CT."
}

require_apt() {
  command -v apt-get >/dev/null 2>&1 || die "This script supports Debian/Ubuntu CTs with apt-get."
}

detect_os() {
  # shellcheck disable=SC1091
  source /etc/os-release
  OS_ID="${ID:-}"
  OS_CODENAME="${VERSION_CODENAME:-}"

  [[ -n "$OS_ID" ]] || die "Cannot detect OS ID from /etc/os-release."
  [[ -n "$OS_CODENAME" ]] || die "Cannot detect OS codename from /etc/os-release."

  case "$OS_ID:$OS_CODENAME" in
    debian:bookworm|ubuntu:jammy|ubuntu:noble|ubuntu:resolute)
      ;;
    *)
      die "Unsupported OS ${OS_ID} ${OS_CODENAME}. Use Debian 12, Ubuntu 22.04, Ubuntu 24.04, or Ubuntu 26.04."
      ;;
  esac
}

validate_inputs() {
  [[ "$POSTGRES_DB" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "Invalid POSTGRES_DB: ${POSTGRES_DB}."
  [[ "$POSTGRES_USER" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "Invalid POSTGRES_USER: ${POSTGRES_USER}."
  [[ "$MONGO_DB" =~ ^[A-Za-z0-9_-]+$ ]] || die "Invalid MONGO_DB: ${MONGO_DB}."
  [[ "$POSTGRES_ALLOWED_CIDR" =~ ^[0-9a-fA-F:\./]+$ ]] || die "Invalid POSTGRES_ALLOWED_CIDR: ${POSTGRES_ALLOWED_CIDR}."
  [[ "$ML_API_PORT" =~ ^[0-9]+$ ]] || die "Invalid ML_API_PORT: ${ML_API_PORT}."
  [[ "$MONGO_EXPRESS_PORT" =~ ^[0-9]+$ ]] || die "Invalid MONGO_EXPRESS_PORT: ${MONGO_EXPRESS_PORT}."
}

generate_password() {
  openssl rand -base64 36 | tr -d '\n'
}

sql_literal() {
  printf "'%s'" "${1//\'/\'\'}"
}

wait_http() {
  local url="$1"
  local name="$2"
  local attempt

  for attempt in {1..30}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  die "${name} health check failed at ${url}."
}

install_base_packages() {
  log_info "Installing base packages."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    jq \
    lsb-release \
    netcat-openbsd \
    openssl \
    python3 \
    git \
    rsync \
    build-essential \
    nodejs \
    npm \
    apache2
}

install_postgres() {
  log_info "Installing PostgreSQL from distribution packages."
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y postgresql postgresql-client
  systemctl enable --now postgresql
}

install_mongodb_repo() {
  local keyring="/usr/share/keyrings/mongodb-server-${MONGODB_MAJOR}.gpg"
  local list_file="/etc/apt/sources.list.d/mongodb-org-${MONGODB_MAJOR}.list"
  local repo_os="$OS_ID"
  local repo_codename="$OS_CODENAME"

  if [[ -n "$MONGODB_REPO_CODENAME" ]]; then
    repo_codename="$MONGODB_REPO_CODENAME"
  elif [[ "$repo_os" = "ubuntu" && "$repo_codename" = "resolute" ]]; then
    repo_codename="noble"
    log_warn "MongoDB ${MONGODB_MAJOR} repository for Ubuntu 26.04/resolute may not be published yet; using Ubuntu 24.04/noble packages."
    log_warn "Override with MONGODB_REPO_CODENAME=resolute when MongoDB publishes a resolute repository."
  fi

  log_info "Configuring MongoDB ${MONGODB_MAJOR} official apt repository."

  curl -fsSL "https://pgp.mongodb.com/server-${MONGODB_MAJOR}.asc" |
    gpg --batch --yes -o "$keyring" --dearmor

  if [[ "$repo_os" = "debian" ]]; then
    printf 'deb [ signed-by=%s ] https://repo.mongodb.org/apt/debian %s/mongodb-org/%s main\n' \
      "$keyring" "$repo_codename" "$MONGODB_MAJOR" >"$list_file"
  elif [[ "$repo_os" = "ubuntu" ]]; then
    printf 'deb [ arch=amd64,arm64 signed-by=%s ] https://repo.mongodb.org/apt/ubuntu %s/mongodb-org/%s multiverse\n' \
      "$keyring" "$repo_codename" "$MONGODB_MAJOR" >"$list_file"
  else
    die "Unsupported MongoDB repo OS: ${repo_os}."
  fi

  apt-get update
}

install_mongodb() {
  install_mongodb_repo

  log_info "Installing MongoDB."
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y mongodb-org
  systemctl enable --now mongod
}

postgres_conf_path() {
  runuser -u postgres -- psql -tAc "SHOW config_file;" | xargs
}

postgres_hba_path() {
  runuser -u postgres -- psql -tAc "SHOW hba_file;" | xargs
}

configure_postgres_network() {
  local conf_file
  local hba_file

  conf_file="$(postgres_conf_path)"
  hba_file="$(postgres_hba_path)"

  log_info "Configuring PostgreSQL listen_addresses in ${conf_file}."
  if grep -Eq "^[#[:space:]]*listen_addresses[[:space:]]*=" "$conf_file"; then
    sed -i "s|^[#[:space:]]*listen_addresses[[:space:]]*=.*|listen_addresses = '${POSTGRES_LISTEN_ADDRESS}'|" "$conf_file"
  else
    printf "\nlisten_addresses = '%s'\n" "$POSTGRES_LISTEN_ADDRESS" >>"$conf_file"
  fi

  if ! grep -Fq "host    ${POSTGRES_DB}    ${POSTGRES_USER}    ${POSTGRES_ALLOWED_CIDR}    scram-sha-256" "$hba_file"; then
    log_info "Allowing PostgreSQL access from ${POSTGRES_ALLOWED_CIDR} in ${hba_file}."
    printf '\nhost    %s    %s    %s    scram-sha-256\n' \
      "$POSTGRES_DB" "$POSTGRES_USER" "$POSTGRES_ALLOWED_CIDR" >>"$hba_file"
  fi

  systemctl restart postgresql
}

configure_postgres_database() {
  local escaped_password

  if [[ -z "$POSTGRES_PASSWORD" ]]; then
    POSTGRES_PASSWORD="$(generate_password)"
  fi

  escaped_password="$(sql_literal "$POSTGRES_PASSWORD")"

  log_info "Creating/updating PostgreSQL role and database."
  if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${POSTGRES_USER}'" | grep -q 1; then
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE \"${POSTGRES_USER}\" LOGIN PASSWORD ${escaped_password};"
  else
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE \"${POSTGRES_USER}\" WITH LOGIN PASSWORD ${escaped_password};"
  fi

  if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_DB}'" | grep -q 1; then
    runuser -u postgres -- createdb --owner="$POSTGRES_USER" "$POSTGRES_DB"
  fi

  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"${POSTGRES_DB}\" OWNER TO \"${POSTGRES_USER}\";"
}

configure_mongodb_network() {
  local conf_file="/etc/mongod.conf"

  log_info "Configuring MongoDB bindIp in ${conf_file}."
  cp "$conf_file" "${conf_file}.bak.$(date +%Y%m%d-%H%M%S)"

  python3 - "$conf_file" "$MONGO_BIND_IP" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
bind_ip = sys.argv[2]
text = path.read_text(encoding="utf-8")

if re.search(r"(?m)^(\s*)bindIp:\s*.*$", text):
    text = re.sub(r"(?m)^(\s*)bindIp:\s*.*$", rf"\1bindIp: {bind_ip}", text)
else:
    text = text.replace("net:\n", f"net:\n  bindIp: {bind_ip}\n", 1)

path.write_text(text, encoding="utf-8")
PY

  systemctl restart mongod
}

ensure_service_user() {
  local user="$1"
  local home_dir="$2"

  if id "$user" >/dev/null 2>&1; then
    return
  fi

  log_info "Creating service user ${user}."
  useradd --system --create-home --home-dir "$home_dir" --shell /usr/sbin/nologin "$user"
}

install_uv() {
  if command -v uv >/dev/null 2>&1; then
    log_info "uv is already installed."
    return
  fi

  log_info "Installing uv."
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh
  command -v uv >/dev/null 2>&1 || die "uv installation failed."
}

resolve_repo_root_from_script() {
  local candidate
  candidate="$(cd -- "${SCRIPT_DIR}/../../.." && pwd -P)"

  if [[ -f "${candidate}/ml/pyproject.toml" ]]; then
    printf '%s\n' "$candidate"
    return
  fi

  return 1
}

sync_app_source() {
  if [[ -f "${APP_SOURCE_DIR}/ml/pyproject.toml" ]]; then
    log_info "Using existing app source at ${APP_SOURCE_DIR}."
    return
  fi

  if resolve_repo_root_from_script >/dev/null 2>&1; then
    local repo_root
    repo_root="$(resolve_repo_root_from_script)"
    log_info "Copying app source from ${repo_root} to ${APP_SOURCE_DIR}."
    mkdir -p "$APP_SOURCE_DIR"
    rsync -a \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='dist' \
      --exclude='dist-server' \
      --exclude='coverage' \
      --exclude='ml/.venv' \
      "${repo_root}/" "${APP_SOURCE_DIR}/"
    return
  fi

  if [[ -n "$APP_REPO_URL" ]]; then
    log_info "Cloning app source from ${APP_REPO_URL} to ${APP_SOURCE_DIR}."
    git clone "$APP_REPO_URL" "$APP_SOURCE_DIR"
    return
  fi

  die "ML API requested but app source is missing. Set APP_REPO_URL or copy the repo to ${APP_SOURCE_DIR}."
}

install_ml_api() {
  if [[ "$INSTALL_ML_API" != "true" ]]; then
    log_info "Skipping ML API installation."
    return
  fi

  install_uv
  sync_app_source
  ensure_service_user "$ML_SERVICE_USER" "/var/lib/${ML_SERVICE_USER}"

  [[ -f "${APP_SOURCE_DIR}/ml/pyproject.toml" ]] || die "Missing ${APP_SOURCE_DIR}/ml/pyproject.toml."

  log_info "Installing Python ${ML_PYTHON_VERSION} for ML API with uv."
  mkdir -p "$UV_PYTHON_INSTALL_DIR"
  UV_PYTHON_INSTALL_DIR="$UV_PYTHON_INSTALL_DIR" uv python install "$ML_PYTHON_VERSION"
  rm -rf "$ML_VENV_DIR"
  UV_PYTHON_INSTALL_DIR="$UV_PYTHON_INSTALL_DIR" uv venv "$ML_VENV_DIR" --python "$ML_PYTHON_VERSION"

  log_info "Installing ML dependencies into ${ML_VENV_DIR}."
  (cd "${APP_SOURCE_DIR}/ml" && UV_PYTHON_INSTALL_DIR="$UV_PYTHON_INSTALL_DIR" uv pip install --python "${ML_VENV_DIR}/bin/python" -e .)

  chown -R "${ML_SERVICE_USER}:${ML_SERVICE_USER}" "$APP_SOURCE_DIR" "$ML_VENV_DIR" "$UV_PYTHON_INSTALL_DIR"

  log_info "Writing summoner-ml-api systemd service."
  cat >/etc/systemd/system/summoner-ml-api.service <<EOF
[Unit]
Description=Summoner Build Lab ML API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${ML_SERVICE_USER}
Group=${ML_SERVICE_USER}
WorkingDirectory=${APP_SOURCE_DIR}/ml
Environment=PATH=${ML_VENV_DIR}/bin:/usr/local/bin:/usr/bin:/bin
Environment=PYTHONUNBUFFERED=1
Environment=ML_API_PORT=${ML_API_PORT}
ExecStart=${ML_VENV_DIR}/bin/python scripts/tasks.py run-api
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now summoner-ml-api
}

install_mongo_express() {
  if [[ "$INSTALL_MONGO_EXPRESS" != "true" ]]; then
    log_info "Skipping mongo-express installation."
    return
  fi

  ensure_service_user "mongo-express" "/var/lib/mongo-express"

  log_info "Installing mongo-express ${MONGO_EXPRESS_VERSION}."
  rm -rf "$MONGO_EXPRESS_DIR"
  mkdir -p "$MONGO_EXPRESS_DIR"

  local mongo_express_tarball
  mongo_express_tarball="$(npm view "mongo-express@${MONGO_EXPRESS_VERSION}" dist.tarball)"
  curl -fsSL "$mongo_express_tarball" | tar -xz --strip-components=1 -C "$MONGO_EXPRESS_DIR"

  node - "$MONGO_EXPRESS_DIR/package.json" <<'NODE'
const fs = require("node:fs");

const packagePath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
  pkg[section] = pkg[section] || {};
  for (const [name, version] of Object.entries(pkg[section])) {
    if (typeof version !== "string" || !version.startsWith("patch:")) {
      continue;
    }

    const match = version.match(/^patch:[^@]+@npm%3A([^#]+)#/);
    if (!match) {
      throw new Error(`Unsupported patch dependency format for ${name}: ${version}`);
    }

    pkg[section][name] = decodeURIComponent(match[1]);
  }
}

delete pkg.devDependencies;
delete pkg.resolutions;
delete pkg.packageManager;

pkg.scripts = {
  ...pkg.scripts,
  start: "node app.js",
};

fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
NODE

  npm --prefix "$MONGO_EXPRESS_DIR" install --omit=dev --no-package-lock --ignore-scripts
  chown -R mongo-express:mongo-express "$MONGO_EXPRESS_DIR"

  log_info "Writing mongo-express systemd service."
  cat >/etc/systemd/system/mongo-express.service <<EOF
[Unit]
Description=mongo-express for Summoner Build Lab
After=network-online.target mongod.service
Wants=network-online.target mongod.service

[Service]
Type=simple
User=mongo-express
Group=mongo-express
WorkingDirectory=${MONGO_EXPRESS_DIR}
Environment=PORT=${MONGO_EXPRESS_PORT}
Environment=ME_CONFIG_MONGODB_URL=mongodb://127.0.0.1:27017/
Environment=ME_CONFIG_BASICAUTH=false
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now mongo-express
}

install_pgadmin_repo() {
  local keyring="/usr/share/keyrings/packages-pgadmin-org.gpg"
  local list_file="/etc/apt/sources.list.d/pgadmin4.list"
  local repo_codename="$OS_CODENAME"

  if [[ -n "$PGADMIN_REPO_CODENAME" ]]; then
    repo_codename="$PGADMIN_REPO_CODENAME"
  elif [[ "$OS_ID" = "ubuntu" && "$repo_codename" = "resolute" ]]; then
    repo_codename="noble"
    log_warn "pgAdmin repository for Ubuntu 26.04/resolute may not be published yet; using Ubuntu 24.04/noble packages."
    log_warn "Override with PGADMIN_REPO_CODENAME=resolute when pgAdmin publishes a resolute repository."
  fi

  log_info "Configuring pgAdmin apt repository."
  curl -fsSL https://www.pgadmin.org/static/packages_pgadmin_org.pub |
    gpg --batch --yes -o "$keyring" --dearmor

  printf 'deb [signed-by=%s] https://ftp.postgresql.org/pub/pgadmin/pgadmin4/apt/%s pgadmin4 main\n' \
    "$keyring" "$repo_codename" >"$list_file"

  apt-get update
}

install_pgadmin() {
  if [[ "$INSTALL_PGADMIN" != "true" ]]; then
    log_info "Skipping pgAdmin installation."
    return
  fi

  if [[ -z "$PGADMIN_PASSWORD" ]]; then
    PGADMIN_PASSWORD="$(generate_password)"
  fi

  install_pgadmin_repo

  log_info "Installing pgAdmin web."
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y pgadmin4-web

  log_info "Configuring pgAdmin web login."
  PGADMIN_SETUP_EMAIL="$PGADMIN_EMAIL" \
    PGADMIN_SETUP_PASSWORD="$PGADMIN_PASSWORD" \
    /usr/pgadmin4/bin/setup-web.sh --yes
}

write_env_file() {
  log_info "Writing ${ENV_FILE}."
  mkdir -p "$BASE_DIR" "$BACKUP_DIR"
  chmod 700 "$BASE_DIR" "$BACKUP_DIR"

  umask 077
  cat >"$ENV_FILE" <<EOF
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_ALLOWED_CIDR=${POSTGRES_ALLOWED_CIDR}
MONGO_DB=${MONGO_DB}
ML_API_PORT=${ML_API_PORT}
MONGO_EXPRESS_PORT=${MONGO_EXPRESS_PORT}
PGADMIN_EMAIL=${PGADMIN_EMAIL}
PGADMIN_PASSWORD=${PGADMIN_PASSWORD}
EOF
}

write_backup_script() {
  local path="${BIN_DIR}/summoner-db-backup"

  log_info "Writing ${path}."
  cat >"$path" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

BASE_DIR="/opt/summoner-build-lab-data"
ENV_FILE="${BASE_DIR}/db.env"
BACKUP_DIR="${BASE_DIR}/backups"

[[ -f "$ENV_FILE" ]] || { echo "Missing ${ENV_FILE}" >&2; exit 1; }

set -a
source "$ENV_FILE"
set +a

timestamp="$(date +%Y%m%d-%H%M%S)"
target_dir="${BACKUP_DIR}/${timestamp}"
mkdir -p "$target_dir"
chmod 700 "$target_dir"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  --host=127.0.0.1 \
  --port=5432 \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --format=custom \
  --file="${target_dir}/postgres.dump"

mongodump \
  --host=127.0.0.1 \
  --db="$MONGO_DB" \
  --archive="${target_dir}/mongo.archive" \
  --gzip

sha256sum "${target_dir}/postgres.dump" "${target_dir}/mongo.archive" >"${target_dir}/SHA256SUMS"
echo "Backup written to ${target_dir}"
EOF
  chmod 0755 "$path"
}

write_restore_script() {
  local path="${BIN_DIR}/summoner-db-restore"

  log_info "Writing ${path}."
  cat >"$path" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$#" -ne 1 ]]; then
  echo "Usage: summoner-db-restore /opt/summoner-build-lab-data/backups/YYYYMMDD-HHMMSS" >&2
  exit 1
fi

BASE_DIR="/opt/summoner-build-lab-data"
ENV_FILE="${BASE_DIR}/db.env"
BACKUP_PATH="$1"

[[ -f "$ENV_FILE" ]] || { echo "Missing ${ENV_FILE}" >&2; exit 1; }
[[ -f "${BACKUP_PATH}/postgres.dump" ]] || { echo "Missing ${BACKUP_PATH}/postgres.dump" >&2; exit 1; }
[[ -f "${BACKUP_PATH}/mongo.archive" ]] || { echo "Missing ${BACKUP_PATH}/mongo.archive" >&2; exit 1; }

set -a
source "$ENV_FILE"
set +a

PGPASSWORD="$POSTGRES_PASSWORD" dropdb \
  --host=127.0.0.1 \
  --port=5432 \
  --username="$POSTGRES_USER" \
  --if-exists \
  "$POSTGRES_DB"

PGPASSWORD="$POSTGRES_PASSWORD" createdb \
  --host=127.0.0.1 \
  --port=5432 \
  --username="$POSTGRES_USER" \
  "$POSTGRES_DB"

PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
  --host=127.0.0.1 \
  --port=5432 \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --clean \
  --if-exists \
  --no-owner \
  "${BACKUP_PATH}/postgres.dump"

mongorestore \
  --host=127.0.0.1 \
  --archive="${BACKUP_PATH}/mongo.archive" \
  --gzip \
  --drop

echo "Restore completed from ${BACKUP_PATH}"
EOF
  chmod 0755 "$path"
}

write_systemd_timer() {
  log_info "Writing daily backup systemd timer."
  cat >/etc/systemd/system/summoner-db-backup.service <<'EOF'
[Unit]
Description=Summoner Build Lab native database backup
After=postgresql.service mongod.service
Wants=postgresql.service mongod.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/summoner-db-backup
EOF

  cat >/etc/systemd/system/summoner-db-backup.timer <<'EOF'
[Unit]
Description=Run Summoner Build Lab database backup daily

[Timer]
OnCalendar=*-*-* 03:15:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now summoner-db-backup.timer
}

verify_services() {
  log_info "Verifying native services."
  systemctl is-active --quiet postgresql || die "PostgreSQL is not active."
  systemctl is-active --quiet mongod || die "MongoDB is not active."

  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    --host=127.0.0.1 \
    --port=5432 \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --command='SELECT 1;' >/dev/null

  mongosh --host=127.0.0.1 "$MONGO_DB" --quiet --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null

  if [[ "$INSTALL_ML_API" = "true" ]]; then
    systemctl is-active --quiet summoner-ml-api || die "summoner-ml-api is not active."
    wait_http "http://127.0.0.1:${ML_API_PORT}/health" "ML API"
  fi

  if [[ "$INSTALL_MONGO_EXPRESS" = "true" ]]; then
    systemctl is-active --quiet mongo-express || die "mongo-express is not active."
    wait_http "http://127.0.0.1:${MONGO_EXPRESS_PORT}/" "mongo-express"
  fi

  if [[ "$INSTALL_PGADMIN" = "true" ]]; then
    systemctl is-active --quiet apache2 || die "apache2/pgAdmin is not active."
    wait_http "http://127.0.0.1/pgadmin4/" "pgAdmin"
  fi
}

print_summary() {
  local ip_address
  ip_address="$(hostname -I | awk '{print $1}')"

  printf '\n'
  log_info "Native data services are ready."
  printf 'CT IP: %s\n' "${ip_address:-unknown}"
  printf 'Postgres URL: postgresql://%s:<password>@%s:5432/%s?schema=public\n' "$POSTGRES_USER" "${ip_address:-CT_IP}" "$POSTGRES_DB"
  printf 'Mongo URL: mongodb://%s:27017/%s\n' "${ip_address:-CT_IP}" "$MONGO_DB"
  printf 'ML API: http://%s:%s\n' "${ip_address:-CT_IP}" "$ML_API_PORT"
  printf 'mongo-express: http://%s:%s\n' "${ip_address:-CT_IP}" "$MONGO_EXPRESS_PORT"
  printf 'pgAdmin: http://%s/pgadmin4/\n' "${ip_address:-CT_IP}"
  printf 'Secrets file: %s\n' "$ENV_FILE"
  printf 'Manual backup: summoner-db-backup\n'
  printf 'Restore: summoner-db-restore %s/YYYYMMDD-HHMMSS\n' "$BACKUP_DIR"
}

main() {
  require_root
  require_apt
  detect_os
  validate_inputs
  install_base_packages
  install_postgres
  configure_postgres_database
  configure_postgres_network
  install_mongodb
  configure_mongodb_network
  install_ml_api
  install_mongo_express
  install_pgadmin
  write_env_file
  write_backup_script
  write_restore_script
  write_systemd_timer
  verify_services
  print_summary
}

main "$@"
