#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 6 ]]; then
  echo "Usage: $0 <bucket> <object-key> <release-id> <domain> <environment-parameter> <region>" >&2
  exit 2
fi

bucket="$1"
object_key="$2"
release_id="$3"
domain="$4"
environment_parameter="$5"
region="$6"
application_root="/opt/ai-product-finder"
archive_path="/tmp/ai-product-finder-${release_id}.tar.gz"
candidate_path="${application_root}/releases/${release_id}.candidate"
release_path="${application_root}/releases/${release_id}"
previous_target=""
environment_backup=""

if [[ ! "${release_id}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Release ID must be a full Git commit SHA." >&2
  exit 1
fi
if [[ ! "${domain}" =~ ^([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$ ]]; then
  echo "Invalid deployment domain." >&2
  exit 1
fi
if [[ ! "${object_key}" =~ ^releases/[0-9a-f]{40}\.tar\.gz$ ]]; then
  echo "Unexpected deployment object key." >&2
  exit 1
fi

install_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node --version)" =~ ^v(22|24)\. ]]; then
    return
  fi

  dnf install -y nodejs22 nodejs22-npm || dnf install -y nodejs npm
  for major_version in 22 24; do
    if command -v "node-${major_version}" >/dev/null 2>&1; then
      ln -sfn "$(command -v "node-${major_version}")" /usr/local/bin/node
    fi
    if command -v "npm-${major_version}" >/dev/null 2>&1; then
      ln -sfn "$(command -v "npm-${major_version}")" /usr/local/bin/npm
    fi
  done

  if ! command -v node >/dev/null 2>&1 ||
      [[ ! "$(node --version)" =~ ^v(22|24)\. ]] ||
      ! command -v npm >/dev/null 2>&1; then
    echo "Node.js 22 or 24 with npm is required." >&2
    exit 1
  fi
}

render_nginx() {
  local template_name="http.conf.template"
  if [[ -s "/etc/letsencrypt/live/${domain}/fullchain.pem" ]]; then
    template_name="https.conf.template"
  fi
  sed "s/__DOMAIN__/${domain}/g" \
    "${release_path}/deploy/nginx/${template_name}" \
    > /etc/nginx/nginx.conf
  nginx -t
}

rollback() {
  trap - ERR
  if [[ -n "${environment_backup}" && -f "${environment_backup}" ]]; then
    mv -f "${environment_backup}" /etc/ai-product-finder/backend.env
  fi
  if [[ -n "${previous_target}" && -d "${previous_target}" ]]; then
    ln -sfn "${previous_target}" "${application_root}/current.rollback"
    mv -Tf "${application_root}/current.rollback" "${application_root}/current"
    systemctl restart ai-product-finder
    render_nginx
    systemctl reload nginx
  fi
}

trap 'rollback' ERR

install_node
if ! getent passwd productfinder >/dev/null; then
  useradd --system --home-dir "${application_root}" --shell /sbin/nologin productfinder
fi

mkdir -p \
  "${application_root}/releases" \
  /etc/ai-product-finder \
  /var/log/ai-product-finder \
  /var/www/letsencrypt
chown productfinder:productfinder \
  /var/log/ai-product-finder
chmod 700 /etc/ai-product-finder

aws s3 cp "s3://${bucket}/${object_key}" "${archive_path}" --region "${region}" --only-show-errors
if tar -tzf "${archive_path}" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  echo "Release archive contains an unsafe path." >&2
  exit 1
fi

rm -rf "${candidate_path}"
mkdir -p "${candidate_path}"
tar -xzf "${archive_path}" -C "${candidate_path}"
rm -f "${archive_path}"

if [[ ! -f "${candidate_path}/Backend/index.js" || ! -f "${candidate_path}/Frontend/dist/index.html" ]]; then
  echo "Release bundle is incomplete." >&2
  exit 1
fi

npm ci --omit=dev --prefix "${candidate_path}/Backend"

environment_tmp="$(mktemp /etc/ai-product-finder/backend.env.XXXXXX)"
aws ssm get-parameter \
  --name "${environment_parameter}" \
  --with-decryption \
  --region "${region}" \
  --query Parameter.Value \
  --output text > "${environment_tmp}"
chown root:productfinder "${environment_tmp}"
chmod 640 "${environment_tmp}"
if [[ -f /etc/ai-product-finder/backend.env ]]; then
  environment_backup="/etc/ai-product-finder/backend.env.rollback"
  cp -a /etc/ai-product-finder/backend.env "${environment_backup}"
fi
mv -f "${environment_tmp}" /etc/ai-product-finder/backend.env

if [[ -L "${application_root}/current" ]]; then
  previous_target="$(readlink -f "${application_root}/current")"
fi

if [[ "${previous_target}" == "${release_path}" ]]; then
  rm -rf "${candidate_path}"
else
  rm -rf "${release_path}"
  mv "${candidate_path}" "${release_path}"
  chown -R root:root "${release_path}"
fi
ln -sfn "${release_path}" "${application_root}/current.next"
mv -Tf "${application_root}/current.next" "${application_root}/current"

install -m 0644 "${release_path}/deploy/systemd/ai-product-finder.service" \
  /etc/systemd/system/ai-product-finder.service
install -m 0644 "${release_path}/deploy/cloudwatch/amazon-cloudwatch-agent.json" \
  /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
systemctl daemon-reload
systemctl enable ai-product-finder
systemctl restart ai-product-finder

render_nginx
systemctl enable nginx
systemctl restart nginx

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

for _ in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:3000/api/health/ready >/dev/null; then
    trap - ERR
    if [[ -n "${environment_backup}" ]]; then
      rm -f "${environment_backup}"
    fi
    echo "Release ${release_id} is ready."
    exit 0
  fi
  sleep 2
done

echo "Release ${release_id} failed readiness." >&2
exit 1
