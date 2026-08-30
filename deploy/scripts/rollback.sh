#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 <full-git-commit-sha>" >&2
  exit 2
fi

application_root="/opt/ai-product-finder"
target="${application_root}/releases/$1"
domain="${DOMAIN_NAME:-samvad.space}"

if [[ ! -d "${target}" ]]; then
  echo "Release does not exist: $1" >&2
  exit 1
fi
if [[ ! -s "/etc/letsencrypt/live/${domain}/fullchain.pem" ]]; then
  nginx_template="${target}/deploy/nginx/http.conf.template"
else
  nginx_template="${target}/deploy/nginx/https.conf.template"
fi

ln -sfn "${target}" "${application_root}/current.rollback"
mv -Tf "${application_root}/current.rollback" "${application_root}/current"
sed "s/__DOMAIN__/${domain}/g" "${nginx_template}" > /etc/nginx/nginx.conf
nginx -t
systemctl restart ai-product-finder
systemctl reload nginx

for _ in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:3000/api/health/ready >/dev/null; then
    echo "Rolled back to $1."
    exit 0
  fi
  sleep 2
done

echo "Rollback target failed readiness." >&2
exit 1
