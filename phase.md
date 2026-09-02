# AI Product Finder implementation status

Updated: 2026-09-03

## Phase 1 / Phase A - Foundation

Status: Complete (minimal scope)

Completed:

- Added workspace-scoped ignore rules and a backend environment template.
- Added validated backend environment and client WebSocket event schemas.
- Added allowlisted Eastman URL builders and validators.
- Added backend fixtures and foundation tests.
- Added backend and frontend scripts for development, build, lint, and tests.

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
- Added optional batched embedding generation with model/dimension metadata,
  content-hash linkage, and a separate versioned `embeddings.jsonl` artifact.

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
- Added conversational query cleanup so generic request words do not displace relevant
  application, chemistry, and performance terms.
- Added validated in-memory cosine vector search for precomputed embeddings.
- Added reciprocal-rank fusion and product-level deduplication.
- Added explicit region alias recognition and safe handling when Phase B memberships
  are incomplete.
- Added deterministic source metadata and categorical outcomes: exact,
  recommendation, clarification, and no evidence.
- Added active-release loading and real-corpus retrieval regression benchmarks.
- Added OpenRouter `z-ai/glm-5.2:free` as the primary answer model with a
  separate backup credential and Vercel free-model fallback.
- Added explicit Vercel AI Gateway errors and retryability metadata.
- Added the local `sampel.env` secret file to Git ignore rules.
- Connected embedded releases to the validated in-memory vector index.
- Added query embedding for non-exact searches, hybrid RRF fusion, strict
  release/model/dimension validation, and lexical fallback on provider failure.
- Verified the active vector artifact is complete across all 979 products/chunks,
  with valid 768-dimensional Gemini vectors and matching source/content hashes.
- Added an optional separate OpenRouter backup key for eligible query-time and
  ingestion failures; cancellation and invalid vector data never trigger failover.

Pending:

- Populate facet memberships before enabling region and other metadata hard filters.
- Expand the benchmark with product families, applications, grades, and negative cases.
- Calibrate retrieval limits, RRF constants, and confidence policy from evaluation results.
- Wire retrieval and Vercel AI Gateway generation into the Phase D chat orchestration.

Generation credentials are read separately from `OPENROUTER_API_KEY`,
`OPENROUTER_BACKUP_API_KEY`, and `VERCEL_AI_GATEWAY_API_KEY`. Generation and embedding
variables remain explicit even when operators provision the same underlying OpenRouter
credentials for both concerns.

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
- Moved conversation authority from client-supplied history to bounded anonymous
  per-session Express memory with reconnect snapshots and logout/expiry cleanup.
- Added deterministic greeting, gratitude, capability, goodbye, obvious off-topic,
  and prompt-injection handling without retrieval, document fetches, model calls,
  or product-turn quota use.
- Added context-aware follow-ups using validated recent FGMNs, ordinal/pronoun
  references, terse TDS/SDS/location questions, and contextual alternative searches.
- Added a three-substantive-product-question session quota with rollback on failure
  or cancellation and an official Eastman product-inquiry handoff on the fourth.
- Added retrieval-first grounded resilient generation orchestration.
- Added ordered primary-key, backup-key, and Vercel provider failover before output.
- Added Vercel gateway-managed free-model fallback from `minimax/minimax-m3-free`
  to `minimax/minimax-m2.7-free`.
- Kept official-site public research on a dedicated Vercel client so its
  `vercel:perplexity_search` tool remains compatible.
- Added safe streaming failover: attempts may switch before the first delta but never
  splice a second provider response into an answer already shown to the user.
- Upgraded orchestration to a query-aware multistep RAG flow: catalog discovery,
  a maximum-three-product shortlist, live TDS enrichment, optional SDS enrichment
  for safety intent, and final grounded generation.
- Added bounded, cached fetching of allowlisted Eastman technical-data pages.
- Added regional SDS selection with a Generic GHS English fallback, form-based
  retrieval of Eastman's generated SDS PDFs, and bounded PDF text extraction.
- Added explicit unavailable-document evidence so a failed or missing TDS/SDS is
  disclosed to the model rather than silently treated as available.
- Added sales-response constraints for direct recommendations, consistent comparison
  criteria, concise technical highlights, safety caveats, and a useful next step.
- Added visible retrieving, source-grounding, and answer-generation progress stages.
- Added deterministic source and product events rather than trusting model output.
- Added HTTP, authentication, orchestration, document-enrichment, WebSocket, and
  request-limit tests.
- Simulated live discovery, comparison, and India-specific SDS scenarios against the
  catalog, Eastman document endpoints, and the configured model gateway. The final comparison returned
  three relevant products in 233 words without a wide table.

Pending:

- Add an application-level model deadline.
- Validate Vercel AI Gateway and upstream-model retention settings before production use.
- Add structured redacted logging, metrics, and active-socket readiness details.
- Add stronger post-generation grounding checks beyond the current evidence-only prompt.
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
- Added safe rendering for concise answer headings, bullet lists, and emphasis so
  sales-oriented responses remain readable in the narrow popup.
- Added client-side HTTPS Eastman hostname validation as defense in depth.
- Added responsive styling, semantic landmarks, labels, visible focus, live regions,
  sufficient touch targets, and reduced-motion behavior.
- Reworked the standalone chat screen into an Eastman-compatible floating product
  assistant over a blurred product-finder page preview.
- Added desktop popup, minimized launcher, phone and short-viewport full-screen modes,
  safe-area spacing, compact product resources, and collapsible source evidence.
- Simplified end-user copy and controls while preserving new-chat cancellation,
  reconnect, access-code, and preview sign-out behavior.
- Added a Vite development proxy for backend HTTP and WebSocket endpoints.
- Added reducer and outbound-link logic tests.
- Stopped sending frontend-authored history; added server transcript restoration,
  quota status, server context clearing, and a post-handoff composer state.
- Validated authentication, the proxied WebSocket, live generated answers, product
  cards, minimize/reopen behavior, and viewport overflow at desktop and mobile sizes.

Pending:

- Add accessible deterministic comparison tables when backend comparison events exist.
- Add high-information clarification chips when structured clarification options exist.
- Add component/browser automation for login, chat, reconnect, and keyboard behavior.
- Add richer grounded fit reasons and active-region chips when backend data is available.

## Phase 6 / Phase F - AWS deployment

Status: Complete (minimal production scope)

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
- Repointed Hostinger DNS to the Elastic IP and enabled HTTPS for
  `samvad.space` with a valid Let's Encrypt certificate.
- Enabled direct trusted HTTPS access at `https://3.108.136.204` with a
  separate six-day Let's Encrypt IP certificate and IP-specific Nginx virtual
  host.
- Enabled and verified automatic certificate renewal with a successful
  staging dry-run for both the domain and short-lived IP certificate workflows.
- Preserved exact-origin enforcement for direct IP access by translating only
  same-origin IP requests at the trusted Nginx boundary; foreign origins remain
  rejected.
- Verified public HTTP-to-HTTPS redirect, security headers, readiness,
  access-code login, authenticated WSS, retrieval, Vercel AI Gateway generation,
  deterministic sources, and product cards.
- Verified rollback between two distinct release commits and restored the
  latest healthy release.

Deferred beyond the minimal deployment:

- Validate Vercel AI Gateway and upstream-model production retention behavior.
- Enable scheduled ingestion only after Phase B supports live source refresh.

## Phase 7 / Phase G - Launch validation

Status: Not started
