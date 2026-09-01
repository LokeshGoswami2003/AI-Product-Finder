# AWS deployment runbook

The MVP runs on one Amazon Linux 2023 `t3.small` instance in `ap-south-1`.
CloudFormation creates an encrypted 20 GiB gp3 root volume, Elastic IP,
HTTP/HTTPS security group, Systems Manager access, CloudWatch collection,
a private versioned deployment bucket, and a repository-scoped GitHub OIDC
deployment role. SSH is deliberately not exposed.

## Architecture

- Nginx serves `Frontend/dist`, proxies `/api/`, and upgrades `/ws/chat`.
- The backend listens only on `127.0.0.1:3000` under systemd.
- Runtime secrets are held in an encrypted SSM `SecureString`, not in Git,
  GitHub variables, user data, or deployment bundles.
- GitHub Actions validates and bundles each commit, uploads it to the private
  deployment bucket, and deploys it through AWS Systems Manager.
- Releases are extracted under `/opt/ai-product-finder/releases/<git-sha>`.
  `/opt/ai-product-finder/current` is switched atomically after installation.
- The previous release is restored automatically when the readiness check
  fails. Operators can also invoke the explicit rollback script.
- Certbot uses the webroot challenge and a systemd timer for renewal.

## Current production deployment

- URL: `https://samvad.space`
- Direct IP URL: `https://3.108.136.204`
- CloudFormation stack: `ai-product-finder-production`
- EC2 instance: `i-0a40a4c71ee5756bc`
- Elastic IP: `3.108.136.204`
- Certificate expiry: 2026-11-28
- Elastic IP certificate expiry: 2026-09-07
- Certificate renewal: `certbot-renew.timer`, verified with a successful
  Let's Encrypt staging dry-run on 2026-08-30
- The Elastic IP uses a separate Let's Encrypt `shortlived` certificate. IP
  certificates are valid for 160 hours, so the same twice-daily renewal timer
  renews it automatically and reloads Nginx only after a successful renewal.

Retrieve the generated shared access code only when needed:

```powershell
aws ssm get-parameter `
  --region ap-south-1 `
  --name /ai-product-finder/production/access-code `
  --with-decryption `
  --query Parameter.Value `
  --output text
```

## Initial provisioning

Prerequisites:

1. AWS CLI access to account `982614288089`.
2. A private GitHub repository named `LokeshGoswami2003/AI-Product-Finder`.
3. `samvad.space` managed in Hostinger DNS.
4. The backend environment stored at
   `/ai-product-finder/production/backend-env` as an SSM `SecureString`.

The production parameter must contain newline-delimited dotenv values with
these exact deployment-specific settings in addition to the remaining values
from `Backend/.env.example`:

```dotenv
NODE_ENV=production
PORT=3000
APP_ORIGIN=https://samvad.space
AI_PROVIDER=vercel
VERCEL_AI_GATEWAY_MODEL=minimax/minimax-m3
CORPUS_ARTIFACT_DIR=/opt/ai-product-finder/current/artifacts
```

Create the parameter with the AWS-managed SSM encryption key. If a
customer-managed KMS key is selected instead, grant the instance role
`kms:Decrypt` for that key.

Deploy the CloudFormation template:

```powershell
aws cloudformation deploy `
  --region ap-south-1 `
  --stack-name ai-product-finder-production `
  --template-file deploy\cloudformation\mvp.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    GitHubOwner=LokeshGoswami2003 `
    GitHubRepository=AI-Product-Finder `
    GitHubSubjectPrefix="repo:LokeshGoswami2003@101193577/AI-Product-Finder@1351404176" `
    DomainName=samvad.space `
    VpcId=<default-vpc-id> `
    SubnetId=<public-subnet-id>
```

Record these stack outputs as GitHub Actions repository variables:

- `AWS_ROLE_ARN` from `GitHubActionsRoleArn`
- `DEPLOYMENT_BUCKET` from `DeploymentBucketName`
- `EC2_INSTANCE_ID` from `InstanceId`
- `DOMAIN_NAME` as `samvad.space`
- `BACKEND_ENV_PARAMETER` as
  `/ai-product-finder/production/backend-env`
- `AWS_REGION` as `ap-south-1`

The workflow deploys on pushes to `main` and can also be run manually.
Repositories created after July 15, 2026 use GitHub's immutable OIDC subject
format, so `GitHubSubjectPrefix` must match the value returned by:

```powershell
gh api repos/LokeshGoswami2003/AI-Product-Finder/actions/oidc/customization/sub
```

The OIDC role trusts only that immutable repository identity and the GitHub
`production` environment, whose deployment branch policy allows only `main`.
Markdown-only commits are excluded from automatic production deployments.

## DNS and first certificate

After the first release is healthy locally, change the Hostinger apex A record
for `samvad.space` to the `PublicIp` stack output. Remove conflicting apex A
and AAAA records. DNS must resolve to the new Elastic IP before requesting a
certificate.

Run the TLS setup through Systems Manager:

```bash
sudo /opt/ai-product-finder/current/deploy/scripts/configure-tls.sh \
  samvad.space operator@example.com
```

This obtains a Let's Encrypt certificate, enables the HTTPS Nginx template,
starts `certbot-renew.timer`, and reloads Nginx. Verify:

```bash
curl --fail https://samvad.space/api/health/live
curl --fail https://samvad.space/api/health/ready
systemctl status ai-product-finder nginx certbot-renew.timer
```

To enable HTTPS directly on the instance's Elastic IP after domain TLS is
active, use the IP-specific setup script:

```bash
sudo /opt/ai-product-finder/current/deploy/scripts/configure-ip-tls.sh \
  3.108.136.204 samvad.space
```

The script installs a Certbot version with IP-certificate support, requests a
separate Let's Encrypt `shortlived` certificate, and adds an IP-specific Nginx
virtual host. The IP endpoint translates only the exact same-origin IP request
to the backend's configured domain origin; other origins remain unchanged and
continue to be rejected. Verify both endpoints:

```bash
curl --fail https://3.108.136.204/api/health/ready
curl --fail https://samvad.space/api/health/ready
sudo /opt/certbot/bin/certbot certificates
systemctl status certbot-renew.timer
```

## Rollback

List releases:

```bash
ls -1 /opt/ai-product-finder/releases
```

Switch to a known release:

```bash
sudo /opt/ai-product-finder/current/deploy/scripts/rollback.sh <git-sha>
```

The rollback command validates the target, atomically switches the `current`
symlink, restarts the backend, reloads Nginx, and requires readiness to pass.

## Operations

Useful commands:

```bash
journalctl -u ai-product-finder --since "30 minutes ago"
tail -f /var/log/ai-product-finder/backend.log
tail -f /var/log/nginx/access.log /var/log/nginx/error.log
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
```

The CloudWatch log groups retain data for 14 days. The stack also creates an
EC2 status-check alarm. Application requests and chat content are not added
to backend logs.

## Known deployment limits

- This is a single-instance MVP and has no automatic failover.
- The active corpus remains a partial local snapshot until Phase B live
  ingestion and facet reconstruction are complete.
- Scheduled ingestion is intentionally not enabled while ingestion only
  rebuilds the bundled snapshot.
- Hostinger DNS changes remain a manual operation because no Hostinger API
  credential is stored in this project.