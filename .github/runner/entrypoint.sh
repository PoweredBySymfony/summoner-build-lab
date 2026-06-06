#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  if [[ -f .runner ]]; then
    ./config.sh remove --unattended --token "${RUNNER_TOKEN}" || true
  fi
}

trap cleanup EXIT INT TERM

if [[ -z "${RUNNER_URL:-}" ]]; then
  echo "RUNNER_URL is required" >&2
  exit 1
fi

if [[ -z "${RUNNER_TOKEN:-}" ]]; then
  echo "RUNNER_TOKEN is required" >&2
  exit 1
fi

RUNNER_NAME="${RUNNER_NAME:-docker-runner-$(hostname)}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,x64,local-sonarqube}"
RUNNER_WORKDIR="${RUNNER_WORKDIR:-_work}"

./config.sh \
  --url "${RUNNER_URL}" \
  --token "${RUNNER_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${RUNNER_LABELS}" \
  --work "${RUNNER_WORKDIR}" \
  --unattended \
  --replace

./run.sh
