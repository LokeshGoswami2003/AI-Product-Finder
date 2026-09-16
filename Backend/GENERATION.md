# Offline Q&A Corpus Generation

This build-only pipeline creates reviewable product Q&A drafts from the active frozen catalog. It does not change the active offline answers and never marks model output as approved.

## Safety defaults

- Request ceiling: **90 requests per minute**.
- Request pacing: one request starts every 667 ms at most; requests are not released in a 90-call burst.
- Token ceiling: 180,000 reserved tokens per rolling minute.
- Worker concurrency: 3.
- Maximum attempts: 5 per job.
- Retry behavior: exponential backoff with jitter for network failures, HTTP 408, HTTP 429, and HTTP 5xx.
- Provider `Retry-After`: always honored, even when longer than the local backoff cap.
- Authentication/authorization failures: HTTP 401 and 403 stop the batch.

Every attempt, including a retry, obtains a new RPM and TPM reservation. The limiter reserves each job's estimated input tokens plus its maximum output tokens before sending the request. Actual throughput can therefore be below 90 RPM when the token limit, response latency, retries, or provider-side throttling requires it.

## Commands

Create or refresh the deterministic generation matrix without making model calls:

```powershell
npm run generate:plan
```

Run a small initial batch:

```powershell
npm run generate -- --limit=5
```

Run the complete matrix:

```powershell
npm run generate
```

Retry jobs previously written to quarantine:

```powershell
npm run generate -- --retry-failed
```

Optional CLI arguments:

- `--limit=N` — select only the first N stable jobs.
- `--artifact-dir=PATH` — use a different artifact root.
- `--run-dir=PATH` — use a different generation run directory.
- `--retry-failed` — do not treat quarantined job IDs as completed.
- `--dry-run` — write and summarize the plan without requiring an API key.

## Build-time configuration

The Bedrock key is needed only for a real generation run. The offline server does not require it.

```dotenv
BEDROCK_API_KEY=<build-time-key>
BEDROCK_MODEL=deepseek.v3.2
GENERATION_MAX_CONCURRENT=3
GENERATION_REQUESTS_PER_MINUTE=90
GENERATION_TOKENS_PER_MINUTE=180000
GENERATION_MAX_ATTEMPTS=5
GENERATION_MAX_DRAFT_ATTEMPTS=2
GENERATION_RETRY_BASE_MS=1000
GENERATION_RETRY_MAX_MS=60000
GENERATION_MAX_OUTPUT_TOKENS=1200
```

Set the RPM and TPM values no higher than the quotas assigned to the selected Bedrock model and account. Lower either value when provider throttling is observed.

## Run artifacts

The default directory is:

`artifacts/generation-runs/<release-id>-product-qa-v2/`

It contains:

- `generation-plan.jsonl` — deterministic input jobs with stable IDs and token estimates.
- `raw-results.jsonl` — append-only successful or explicitly unsupported model responses.
- `quarantine.jsonl` — append-only request, parse, or validation failures.
- `checkpoint.json` — atomically replaced aggregate progress and token usage.

Generation run directories are ignored by Git because raw model output is build material, not an approved runtime artifact.

## Resume and review rules

Re-running the same release and prompt version skips successful job IDs. By default it also skips quarantined jobs so repeated permanent failures do not consume quota. Use `--retry-failed` only after fixing the cause.

Transport retries and draft-validation retries are separate. A job makes at most two draft attempts by default when the model returns malformed JSON or unsupported enum labels; every replacement attempt receives a fresh RPM and TPM reservation. The last invalid response is retained in quarantine for diagnosis.

Successful records have `validationStatus: "pending_review"`. They must be reviewed, transformed into runtime `answers.jsonl` and `questions.jsonl` records, checked for conflicts and source references, and explicitly approved before publication. The generator never writes into the active release.

## Review and publication

Export successful raw results to an editable review queue:

```powershell
npm run review:export
```

Each record starts with `decision: "pending"`. A reviewer must choose one of:

- `approve` — accept the generated draft unchanged.
- `edit` — use the supplied `editedDraft` instead.
- `reject` — exclude the draft from publication.

Every completed decision requires `reviewer` and `reviewedAt`. If the product already has an approved overview, the reviewer must set `replaceAnswerId` to that exact existing answer ID. The export command refuses to overwrite an existing review queue unless `--force` is passed.

For an internal proof of concept only, apply deterministic bulk decisions to the exported queue:

```powershell
npm run review:poc
```

This explicitly labels the reviewer as `poc-automated-review`, approves only supported drafts that pass the generation schema and normalized-question conflict checks, rejects unsupported/conflicting drafts, and fills required replacement IDs. It does not publish or activate anything. Production releases still require human review.

Validate all decisions and preview the release without writing anything:

```powershell
npm run review:check
```

Build a new immutable release without changing the active pointer:

```powershell
npm run review:publish
```

Build and atomically activate a reviewed release:

```powershell
npm run review:publish -- --activate
```

Verify that the active release loads and answers through both HTTP readiness and the WebSocket chat protocol without using Bedrock:

```powershell
npm run smoke:offline
```

Publication is blocked when any decision is still pending, an approval lacks reviewer metadata, a normalized question conflicts with another answer, an FGMN is unknown, or replacement of an existing product/intent answer is not explicit. The new manifest records SHA-256 hashes for every copied or generated payload file and the hash of the review decisions.

## Current dry-run size

For release `20260902T172534143Z-7daaf5c5`:

- Jobs: 979.
- Estimated input tokens: 586,382.
- Reserved output tokens: 1,174,800.
- Request-limit-only floor at 90 RPM: 10.88 minutes.

This time is a theoretical lower bound. Token reservations, model latency, retries, and provider throttling may increase it.
