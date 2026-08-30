#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <output.tar.gz>" >&2
  exit 2
fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
output_path="$1"

for required_path in \
  Backend/index.js \
  Backend/package.json \
  Backend/package-lock.json \
  Frontend/dist/index.html \
  artifacts/current.json \
  deploy/scripts/install-release.sh; do
  if [[ ! -e "${repository_root}/${required_path}" ]]; then
    echo "Required release path is missing: ${required_path}" >&2
    exit 1
  fi
done

tar \
  --create \
  --gzip \
  --file "${output_path}" \
  --directory "${repository_root}" \
  Backend/index.js \
  Backend/package.json \
  Backend/package-lock.json \
  Backend/src \
  Frontend/dist \
  artifacts \
  deploy
