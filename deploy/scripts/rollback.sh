#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 <full-git-commit-sha>" >&2
  exit 2
fi

application_root="/opt/ai-product-finder"
target="${application_root}/releases/$1"
domain="${DOMAIN_NAME:-samvad.space}"
script_path="$(readlink -f "${BASH_SOURCE[0]}")"
ip_template="$(dirname "${script_path}")/../nginx/ip-https.conf.template"
metadata_token=""
public_ip=""

if [[ ! -d "${target}" ]]; then
  echo "Release does not exist: $1" >&2
  exit 1
fi
if [[ ! -s "/etc/letsencrypt/live/${domain}/fullchain.pem" ]]; then
  nginx_template="${target}/deploy/nginx/http.conf.template"
else
  nginx_template="${target}/deploy/nginx/https.conf.template"
fi

metadata_token="$(curl --fail --silent --show-error -X PUT \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' \
  http://169.254.169.254/latest/api/token)"
public_ip="$(curl --fail --silent --show-error \
  -H "X-aws-ec2-metadata-token: ${metadata_token}" \
  http://169.254.169.254/latest/meta-data/public-ipv4)"

ln -sfn "${target}" "${application_root}/current.rollback"
mv -Tf "${application_root}/current.rollback" "${application_root}/current"
sed "s/__DOMAIN__/${domain}/g" "${nginx_template}" > /etc/nginx/nginx.conf
mkdir -p /etc/nginx/conf.d
if [[ -s "/etc/letsencrypt/live/${public_ip}/fullchain.pem" &&
      -f "${ip_template}" ]]; then
  sed \
    -e "s/__DOMAIN__/${domain}/g" \
    -e "s/__PUBLIC_IP__/${public_ip}/g" \
    "${ip_template}" \
    > /etc/nginx/conf.d/ai-product-finder-ip-https.conf
  sed -i '\|^[[:space:]]*include /etc/nginx/conf.d/\*\.conf;$|d' \
    /etc/nginx/nginx.conf
  sed -i '0,/^[[:space:]]*server {/s//    include \/etc\/nginx\/conf.d\/*.conf;\n\n&/' \
    /etc/nginx/nginx.conf
fi
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
