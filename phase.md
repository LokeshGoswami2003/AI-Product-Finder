# AI Product Finder implementation status

Updated: 2026-08-30

## Phase 1 / Phase A - Foundation

Status: Complete (minimal scope)

Completed:

- Added root ignore rules and an environment-variable template.
- Added validated backend environment and client WebSocket event schemas.
- Added allowlisted Eastman URL builders and validators.
- Added backend fixtures and foundation tests.
- Added root scripts for backend, frontend, build, lint, and tests.

Deferred to later phases:

- Server integration of configuration and protocol schemas belongs to Phase D.
- Full artifact schemas and live source behavior belong to Phase B.

## Phase 2 / Phase B - Ingestion

Status: In progress

Completed:

- Added validation for the local product-finder snapshot.
- Added conversion of source string booleans and numeric counts.
- Added safe HTML-to-text and Unicode/whitespace normalization.
- Added normalized products, facets, and product-summary chunks.
- Added content hashing, versioned release manifests, reports, and JSONL output.
- Added candidate validation for product counts, unique IDs, chunks, and source URL allowlisting.
- Added temporary-directory release creation and atomic `current.json` pointer activation.
- Added a local ingestion CLI and focused ingestion tests.

Pending:

- Fetch the current catalog with conditional requests, retry rules, and bounded concurrency.
- Reconstruct facet memberships using one-facet queries.
- Capture and validate authored canonical links rather than relying on generated fallbacks.
- Fetch and normalize product detail and TDS sources.
- Add incremental source reuse and freshness metadata.
- Add full candidate validation and retrieval smoke tests before marking releases complete.
- Keep a previous known-good complete release and expose degraded freshness state.

The current local release is deliberately reported as `partial`; it must not be treated as
a production-ready corpus until facet memberships and canonical source ingestion are complete.

## Phase 3 / Phase C - Retrieval

Status: In progress

Completed:

- Added exact FGMN, normalized display-name, sort-name, and alias resolution.
- Added weighted lexical, prefix, and fuzzy retrieval with MiniSearch.
- Added validated in-memory cosine vector search for precomputed embeddings.
- Added reciprocal-rank fusion and product-level deduplication.
- Added explicit region alias recognition and safe handling when Phase B memberships
  are incomplete.
- Added deterministic source metadata and categorical outcomes: exact,
  recommendation, clarification, and no evidence.
- Added active-release loading and real-corpus retrieval regression benchmarks.
- Configured OpenRouter as the MVP provider with the `openrouter/free` router.
- Added two-key rotation for key-specific authorization, credit, and rate-limit failures.
- Added the local `sampel.env` secret file to Git ignore rules.

Pending:

- Generate embeddings during Phase B and connect query embedding generation to vector search.
- Populate facet memberships before enabling region and other metadata hard filters.
- Expand the benchmark with product families, applications, grades, and negative cases.
- Calibrate retrieval limits, RRF constants, and confidence policy from evaluation results.
- Wire retrieval and OpenRouter generation into the Phase D chat orchestration.

OpenRouter keys are read from `OPENROUTER_API_KEYS` as a comma-separated secret value.
The selected `openrouter/free` router uses currently available free models rather than
pinning the MVP to a free model that may later be removed.

## Phase 4 / Phase D - Backend and chat

Status: In progress

Completed:

- Split Express application creation from HTTP server startup.
- Added liveness and corpus-aware readiness endpoints.
- Added exact-origin, rate-limited shared-code login.
- Added short-lived signed HttpOnly, SameSite=Strict session cookies and logout.
- Added constant-time access-code and cookie-signature comparisons.
- Added authenticated, exact-origin WebSocket upgrades on `/ws/chat`.
- Added protocol-ready, accepted, progress, answer, source, product, done, and safe
  error events.
- Added one-active-request behavior, explicit cancellation, disconnect aborts,
  payload/history limits, and native ping/pong heartbeats.
- Added retrieval-first grounded OpenRouter orchestration.
- Added deterministic source and product events rather than trusting model output.
- Added HTTP, authentication, orchestration, WebSocket, and request-limit tests.

Pending:

- Stream OpenRouter response deltas instead of returning one complete delta.
- Add an application-level model deadline and retry policy before output begins.
- Validate OpenRouter provider retention and data-sharing settings before production use.
- Add structured redacted logging, metrics, and active-socket readiness details.
- Add deterministic comparison presentation and stronger generated-answer grounding checks.
- Add production proxy-trust configuration and end-to-end Nginx tests.

## Phase 5 / Phase E - Frontend

Status: In progress

Completed:

- Added session detection and a focused access-code gate with show/hide behavior.
- Added generic invalid-code, rate-limit, and service-unavailable states.
- Added an authenticated chat shell with local tab-only conversation state.
- Added starter prompts, multiline Enter/Shift+Enter behavior, input count, send,
  cancellation, clear-chat, and sign-out controls.
- Added WebSocket connection status, capped reconnect behavior, and no automatic
  request replay.
- Added stage announcements, streamed-delta accumulation, deterministic product
  cards, and official source links.
- Added client-side HTTPS Eastman hostname validation as defense in depth.
- Added responsive styling, semantic landmarks, labels, visible focus, live regions,
  sufficient touch targets, and reduced-motion behavior.
- Added a Vite development proxy for backend HTTP and WebSocket endpoints.
- Added reducer and outbound-link logic tests.

Pending:

- Add accessible deterministic comparison tables when backend comparison events exist.
- Add high-information clarification chips when structured clarification options exist.
- Add component/browser automation for login, chat, reconnect, and keyboard behavior.
- Validate the complete experience against live OpenRouter responses.
- Add richer grounded fit reasons and active-region chips when backend data is available.

## Phase 6 / Phase F - AWS deployment

Status: In progress

Completed:

- Added CloudFormation for a `t3.small` Amazon Linux 2023 instance, encrypted
  gp3 EBS, Elastic IP, HTTP/HTTPS security group, deployment bucket, SSM-only
  administration, CloudWatch collection, and EC2 status alarm.
- Added least-privilege EC2 and repository-scoped GitHub Actions OIDC roles.
- Added hardened systemd backend service and Nginx HTTP/HTTPS configurations
  for static frontend, API proxying, and WebSocket upgrades.
- Added versioned release installation, automatic failed-deploy rollback, and
  explicit operator rollback scripts.
- Added SSM Parameter Store runtime-environment loading so secrets are not
  present in GitHub or deployment bundles.
- Added GitHub Actions validation, release packaging, S3 upload, and SSM
  deployment workflow.
- Added Certbot webroot setup and automatic renewal timer.
- Added a deployment and operations runbook.
- Added loopback-only production proxy trust in Express.
- Provisioned the production stack in `ap-south-1` with Elastic IP
  `3.108.136.204` and verified SSM registration and base packages.
- Created the private GitHub repository and configured repository-scoped OIDC
  deployment variables without storing AWS credentials in GitHub.
- Deployed the first release through GitHub Actions and verified OIDC, S3,
  SSM, Node 22, systemd, Nginx, backend readiness, CloudWatch, and rollback.

Pending:

- Replace the stale Hostinger A record with the stack Elastic IP.
- Issue and verify the first Let's Encrypt certificate after DNS propagates.
- Run public HTTPS, WSS, login, and OpenRouter smoke tests.
- Validate OpenRouter production retention/data-sharing behavior.
- Enable scheduled ingestion only after Phase B supports live source refresh.

## Phase 7 / Phase G - Launch validation

Status: Not started