#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${RUNNER_URL:-}" ]]; then
  echo "RUNNER_URL is required" >&2
  exit 1
fi

if [[ ! -f ./config.sh ]]; then
  sudo cp -a /opt/actions-runner/. /home/runner/actions-runner/
fi

sudo chown -R runner:runner /home/runner

RUNNER_NAME="${RUNNER_NAME:-docker-runner-$(hostname)}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,x64,local-sonarqube}"
RUNNER_WORKDIR="${RUNNER_WORKDIR:-_work}"

sudo mkdir -p "${RUNNER_WORKDIR}" "${RUNNER_WORKDIR}/_tool"
sudo chown -R runner:runner "${RUNNER_WORKDIR}"

if [[ -S /var/run/docker.sock ]]; then
  sudo chmod 666 /var/run/docker.sock
fi

if [[ ! -f .runner ]]; then
  if [[ -z "${RUNNER_TOKEN:-}" ]]; then
    echo "RUNNER_TOKEN is required for first-time registration" >&2
    exit 1
  fi

  ./config.sh \
    --url "${RUNNER_URL}" \
    --token "${RUNNER_TOKEN}" \
    --name "${RUNNER_NAME}" \
    --labels "${RUNNER_LABELS}" \
    --work "${RUNNER_WORKDIR}" \
    --unattended \
    --replace
fi

./run.sh
