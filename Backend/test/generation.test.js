const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { BedrockError } = require("../src/bedrock/client");
const { parseGenerationEnv } = require("../src/generation/config");
const {
  createGenerationJobs,
  stableJobId,
  summarizePlan,
} = require("../src/generation/planner");
const { SlidingWindowRateLimiter } = require("../src/generation/rate-limiter");
const { withRetry } = require("../src/generation/retry");
const {
  GenerationRunStore,
  readJsonLinesIfPresent,
} = require("../src/generation/run-store");
const { runGeneration } = require("../src/generation/runner");

const product = {
  fgmn: "71103853",
  displayName: "AdapT 100",
  description: "AdapT 100 is an MDEA-based solvent.",
  documents: {
    hasTds: true,
    hasSds: true,
    hasSalesSpecification: true,
  },
};

function oneJob() {
  return createGenerationJobs({
    manifest: { releaseId: "release-1" },
    products: [product],
    maxOutputTokens: 1200,
  })[0];
}

function draftCompletion() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            supported: true,
            answer: {
              title: "AdapT 100 overview",
              answer:
                "AdapT 100 is an MDEA-based solvent. What is your application?",
              keywords: ["adapt 100", "mdea", "solvent"],
            },
            questions: [
              {
                text: "Tell me about AdapT 100",
                intent: "product_overview",
                variantType: "canonical",
              },
              {
                text: "What is product 71103853?",
                intent: "product_overview",
                variantType: "fgmn",
              },
              {
                text: "Does AdapT 100 have product documents?",
                intent: "document_availability",
                variantType: "document",
              },
              {
                text: "Is AdapT 100 an MDEA solvent?",
                intent: "product_feature",
                variantType: "paraphrase",
              },
            ],
          }),
        },
      },
    ],
    usage: { total_tokens: 400 },
    model: "test-model",
  };
}

const retry = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  random: () => 0,
  sleepImpl: async () => {},
};

test("generation configuration defaults to a paced 90 RPM", () => {
  const config = parseGenerationEnv({
    BEDROCK_API_KEY: "b".repeat(20),
  });

  assert.equal(config.GENERATION_REQUESTS_PER_MINUTE, 90);
  assert.equal(config.GENERATION_MAX_CONCURRENT, 3);
  assert.equal(config.GENERATION_TOKENS_PER_MINUTE, 180000);
  assert.equal(config.GENERATION_MAX_DRAFT_ATTEMPTS, 2);
});

test("generation jobs are stable and report reserved tokens", () => {
  const first = oneJob();
  const second = oneJob();
  const summary = summarizePlan([first]);

  assert.equal(first.jobId, second.jobId);
  assert.equal(first.jobId, stableJobId("release-1", "71103853"));
  assert.equal(first.evidenceIds[0], "catalog:71103853");
  assert.equal(summary.jobCount, 1);
  assert.equal(summary.reservedOutputTokens, 1200);
});

test("rate limiter smooths requests to the 90 RPM interval", async () => {
  let currentTime = 0;
  const waits = [];
  const limiter = new SlidingWindowRateLimiter({
    requestsPerMinute: 90,
    tokensPerMinute: 180000,
    now: () => currentTime,
    sleepImpl: async (ms) => {
      waits.push(ms);
      currentTime += ms;
    },
  });

  await limiter.acquire(1000);
  await limiter.acquire(1000);

  assert.deepEqual(waits, [667]);
});

test("rate limiter waits for token capacity independently of RPM", async () => {
  let currentTime = 0;
  const waits = [];
  const limiter = new SlidingWindowRateLimiter({
    requestsPerMinute: 100,
    tokensPerMinute: 100,
    windowMs: 1000,
    now: () => currentTime,
    sleepImpl: async (ms) => {
      waits.push(ms);
      currentTime += ms;
    },
  });

  await limiter.acquire(60);
  await limiter.acquire(60);

  assert.deepEqual(waits, [1000]);
});

test("retry honors Retry-After and retries only transient failures", async () => {
  const waits = [];
  let attempts = 0;
  const result = await withRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new BedrockError("rate limited", {
          status: 429,
          retryAfterMs: 2500,
        });
      }
      return "ok";
    },
    {
      ...retry,
      sleepImpl: async (ms) => waits.push(ms),
    },
  );

  assert.deepEqual(result, { value: "ok", attempts: 2 });
  assert.deepEqual(waits, [2500]);

  await assert.rejects(
    () =>
      withRetry(async () => {
        throw new BedrockError("denied", { status: 403 });
      }, retry),
    /denied/,
  );
});

test("retry never truncates a provider Retry-After value", async () => {
  const waits = [];
  let attempts = 0;
  await withRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new BedrockError("rate limited", {
          status: 429,
          retryAfterMs: 10000,
        });
      }
      return "ok";
    },
    {
      ...retry,
      maxDelayMs: 5000,
      sleepImpl: async (ms) => waits.push(ms),
    },
  );

  assert.deepEqual(waits, [10000]);
});

test("generation appends a draft and skips it after restart", async (context) => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "generation-run-"));
  context.after(() => rm(runDir, { recursive: true, force: true }));
  const job = oneJob();
  let calls = 0;
  const client = {
    createChatCompletion: async () => {
      calls += 1;
      return draftCompletion();
    },
  };
  const limiter = { acquire: async () => {} };
  const store = await new GenerationRunStore(runDir).initialize();

  const first = await runGeneration({
    jobs: [job],
    client,
    limiter,
    store,
    retry,
  });
  const resumedStore = await new GenerationRunStore(runDir).initialize();
  const second = await runGeneration({
    jobs: [job],
    client,
    limiter,
    store: resumedStore,
    retry,
  });
  const records = await readJsonLinesIfPresent(
    path.join(runDir, "raw-results.jsonl"),
  );

  assert.equal(first.attemptedJobs, 1);
  assert.equal(second.skippedJobs, 1);
  assert.equal(calls, 1);
  assert.equal(records.length, 1);
  assert.equal(records[0].validationStatus, "pending_review");
});

test("generation retries an invalid draft through the limiter", async (context) => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "generation-run-"));
  context.after(() => rm(runDir, { recursive: true, force: true }));
  const store = await new GenerationRunStore(runDir).initialize();
  let calls = 0;
  let reservations = 0;

  const summary = await runGeneration({
    jobs: [oneJob()],
    client: {
      createChatCompletion: async () => {
        calls += 1;
        return calls === 1
          ? { choices: [{ message: { content: "not json" } }] }
          : draftCompletion();
      },
    },
    limiter: {
      acquire: async () => {
        reservations += 1;
      },
    },
    store,
    retry: { ...retry, maxDraftAttempts: 2 },
  });

  assert.equal(calls, 2);
  assert.equal(reservations, 2);
  assert.equal(summary.succeeded, 1);
  assert.equal(summary.quarantined, 0);
});

test("invalid model output is quarantined and not promoted", async (context) => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "generation-run-"));
  context.after(() => rm(runDir, { recursive: true, force: true }));
  const store = await new GenerationRunStore(runDir).initialize();

  const summary = await runGeneration({
    jobs: [oneJob()],
    client: {
      createChatCompletion: async () => ({
        choices: [{ message: { content: "not json" } }],
      }),
    },
    limiter: { acquire: async () => {} },
    store,
    retry,
  });
  const quarantine = await readJsonLinesIfPresent(
    path.join(runDir, "quarantine.jsonl"),
  );
  const results = await readJsonLinesIfPresent(
    path.join(runDir, "raw-results.jsonl"),
  );

  assert.equal(summary.quarantined, 1);
  assert.equal(quarantine.length, 1);
  assert.equal(results.length, 0);
});

test("authentication failure stops a sequential batch", async (context) => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "generation-run-"));
  context.after(() => rm(runDir, { recursive: true, force: true }));
  const store = await new GenerationRunStore(runDir).initialize();
  const jobs = [oneJob(), { ...oneJob(), jobId: "second-job" }];
  let calls = 0;

  await assert.rejects(
    () =>
      runGeneration({
        jobs,
        client: {
          createChatCompletion: async () => {
            calls += 1;
            throw new BedrockError("denied", { status: 403 });
          },
        },
        limiter: { acquire: async () => {} },
        store,
        maxConcurrent: 1,
        retry,
      }),
    /denied/,
  );

  assert.equal(calls, 1);
});
