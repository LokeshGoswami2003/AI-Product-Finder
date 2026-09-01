#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <public-ipv4> <domain>" >&2
  exit 2
fi

public_ip="$1"
domain="$2"
application_root="/opt/ai-product-finder"
certbot_path="/opt/certbot/bin/certbot"

if [[ ! "${public_ip}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "Invalid public IPv4 address." >&2
  exit 1
fi
IFS='.' read -r -a octets <<< "${public_ip}"
for octet in "${octets[@]}"; do
  if (( octet < 0 || octet > 255 )); then
    echo "Invalid public IPv4 address." >&2
    exit 1
  fi
done
if [[ ! "${domain}" =~ ^([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$ ]]; then
  echo "Invalid domain." >&2
  exit 1
fi

metadata_token="$(curl --fail --silent --show-error -X PUT \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' \
  http://169.254.169.254/latest/api/token)"
instance_public_ip="$(curl --fail --silent --show-error \
  -H "X-aws-ec2-metadata-token: ${metadata_token}" \
  http://169.254.169.254/latest/meta-data/public-ipv4)"
if [[ "${public_ip}" != "${instance_public_ip}" ]]; then
  echo "Requested IP address is not assigned to this instance." >&2
  exit 1
fi
if [[ ! -d /etc/letsencrypt/accounts ]]; then
  echo "Configure domain TLS before requesting the IP certificate." >&2
  exit 1
fi

certbot_version="$("${certbot_path}" --version 2>/dev/null | awk '{ print $2 }' || true)"
certbot_major="${certbot_version%%.*}"
certbot_minor="${certbot_version#*.}"
certbot_minor="${certbot_minor%%.*}"
if [[ ! "${certbot_major}" =~ ^[0-9]+$ ]] ||
    [[ ! "${certbot_minor}" =~ ^[0-9]+$ ]] ||
    (( certbot_major < 5 || (certbot_major == 5 && certbot_minor < 4) )); then
  dnf install -y python3.11
  rm -rf /opt/certbot-previous
  if [[ -d /opt/certbot ]]; then
    mv /opt/certbot /opt/certbot-previous
  fi
  python3.11 -m venv /opt/certbot
  /opt/certbot/bin/pip install --disable-pip-version-check --upgrade pip certbot
  "${certbot_path}" --help all | grep -q -- '--ip-address'
fi

mkdir -p /var/www/letsencrypt /etc/nginx/conf.d
"${certbot_path}" certonly \
  --non-interactive \
  --agree-tos \
  --preferred-profile shortlived \
  --webroot \
  --webroot-path /var/www/letsencrypt \
  --ip-address "${public_ip}" \
  --cert-name "${public_ip}"

sed \
  -e "s/__DOMAIN__/${domain}/g" \
  -e "s/__PUBLIC_IP__/${public_ip}/g" \
  "${application_root}/current/deploy/nginx/ip-https.conf.template" \
  > /etc/nginx/conf.d/ai-product-finder-ip-https.conf

sed -i '\|^[[:space:]]*include /etc/nginx/conf.d/\*\.conf;$|d' \
  /etc/nginx/nginx.conf
sed -i '0,/^[[:space:]]*server {/s//    include \/etc\/nginx\/conf.d\/*.conf;\n\n&/' \
  /etc/nginx/nginx.conf

install -m 0644 "${application_root}/current/deploy/systemd/certbot-renew.service" \
  /etc/systemd/system/certbot-renew.service
install -m 0644 "${application_root}/current/deploy/systemd/certbot-renew.timer" \
  /etc/systemd/system/certbot-renew.timer
systemctl daemon-reload
systemctl enable --now certbot-renew.timer
nginx -t
systemctl reload nginx

curl \
  --fail \
  --silent \
  --show-error \
  --resolve "${public_ip}:443:127.0.0.1" \
  "https://${public_ip}/api/health/ready" >/dev/null
echo "TLS is active for ${public_ip}."
