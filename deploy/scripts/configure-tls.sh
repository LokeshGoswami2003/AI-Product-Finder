#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <domain> <letsencrypt-email>" >&2
  exit 2
fi

domain="$1"
email="$2"
application_root="/opt/ai-product-finder"

if [[ ! "${domain}" =~ ^([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$ ]]; then
  echo "Invalid domain." >&2
  exit 1
fi
if [[ ! "${email}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "Invalid email address." >&2
  exit 1
fi
metadata_token="$(curl --fail --silent --show-error -X PUT \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' \
  http://169.254.169.254/latest/api/token)"
instance_public_ip="$(curl --fail --silent --show-error \
  -H "X-aws-ec2-metadata-token: ${metadata_token}" \
  http://169.254.169.254/latest/meta-data/public-ipv4)"
resolved_ip="$(getent ahostsv4 "${domain}" | awk 'NR == 1 { print $1 }')"
if [[ "${resolved_ip}" != "${instance_public_ip}" ]]; then
  echo "Domain does not resolve to this instance." >&2
  exit 1
fi

if [[ ! -x /opt/certbot/bin/certbot ]]; then
  python3 -m venv /opt/certbot
  /opt/certbot/bin/pip install --disable-pip-version-check --upgrade pip certbot
fi

mkdir -p /var/www/letsencrypt
/opt/certbot/bin/certbot certonly \
  --non-interactive \
  --agree-tos \
  --email "${email}" \
  --webroot \
  --webroot-path /var/www/letsencrypt \
  --domain "${domain}"

sed "s/__DOMAIN__/${domain}/g" \
  "${application_root}/current/deploy/nginx/https.conf.template" \
  > /etc/nginx/nginx.conf
nginx -t
systemctl reload nginx

install -m 0644 "${application_root}/current/deploy/systemd/certbot-renew.service" \
  /etc/systemd/system/certbot-renew.service
install -m 0644 "${application_root}/current/deploy/systemd/certbot-renew.timer" \
  /etc/systemd/system/certbot-renew.timer
systemctl daemon-reload
systemctl enable --now certbot-renew.timer

curl --fail --silent --show-error "https://${domain}/api/health/ready" >/dev/null
echo "TLS is active for ${domain}."
