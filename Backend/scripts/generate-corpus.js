const { mkdir, rename, writeFile } = require("node:fs/promises");
const path = require("node:path");

const { BedrockClient } = require("../src/bedrock/client");
const { createLogger } = require("../src/config/logger");
const { loadActiveRelease } = require("../src/corpus/load-release");
const { parseGenerationEnv } = require("../src/generation/config");
const {
  PROMPT_VERSION,
  createGenerationJobs,
  summarizePlan,
} = require("../src/generation/planner");
const { SlidingWindowRateLimiter } = require("../src/generation/rate-limiter");
const { GenerationRunStore } = require("../src/generation/run-store");
const { runGeneration } = require("../src/generation/runner");

function parseArguments(args) {
  const options = {
    dryRun: false,
    retryFailed: false,
    limit: null,
    artifactDir: null,
    runDir: null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--retry-failed") options.retryFailed = true;
    else if (argument === "--limit") options.limit = Number(args[++index]);
    else if (argument.startsWith("--limit=")) {
      options.limit = Number(argument.slice("--limit=".length));
    } else if (argument === "--artifact-dir") {
      options.artifactDir = args[++index];
    } else if (argument.startsWith("--artifact-dir=")) {
      options.artifactDir = argument.slice("--artifact-dir=".length);
    } else if (argument === "--run-dir") options.runDir = args[++index];
    else if (argument.startsWith("--run-dir=")) {
      options.runDir = argument.slice("--run-dir=".length);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (
    options.limit !== null &&
    (!Number.isInteger(options.limit) || options.limit < 1)
  ) {
    throw new Error("--limit must be a positive integer");
  }
  return options;
}

async function writePlan(filePath, jobs) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(
    temporaryPath,
    `${jobs.map((job) => JSON.stringify(job)).join("\n")}\n`,
    "utf8",
  );
  await rename(temporaryPath, filePath);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const repositoryRoot = path.resolve(__dirname, "..", "..");
  const artifactDir = path.resolve(
    options.artifactDir ||
      process.env.CORPUS_ARTIFACT_DIR ||
      path.join(repositoryRoot, "artifacts"),
  );
  const corpus = await loadActiveRelease(artifactDir);
  const maxOutputTokens = Number(
    process.env.GENERATION_MAX_OUTPUT_TOKENS || 1200,
  );
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1) {
    throw new Error("GENERATION_MAX_OUTPUT_TOKENS must be a positive integer");
  }
  let jobs = createGenerationJobs({
    manifest: corpus.manifest,
    products: corpus.products,
    maxOutputTokens,
  });
  if (options.limit !== null) jobs = jobs.slice(0, options.limit);
  const runDir = path.resolve(
    options.runDir ||
      path.join(
        artifactDir,
        "generation-runs",
        `${corpus.manifest.releaseId}-${PROMPT_VERSION}`,
      ),
  );
  await mkdir(runDir, { recursive: true });
  await writePlan(path.join(runDir, "generation-plan.jsonl"), jobs);

  const requestsPerMinute = Number(
    process.env.GENERATION_REQUESTS_PER_MINUTE || 90,
  );
  const plan = {
    releaseId: corpus.manifest.releaseId,
    promptVersion: PROMPT_VERSION,
    runDir,
    requestsPerMinute,
    minimumMinutesAtRequestLimit:
      Math.ceil((jobs.length / requestsPerMinute) * 100) / 100,
    ...summarizePlan(jobs),
  };
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }

  const config = parseGenerationEnv(process.env);
  const logger = createLogger({
    name: "corpus-generation",
    level: process.env.LOG_LEVEL || "info",
  });
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort(new Error("Interrupted")));
  const client = new BedrockClient({
    apiKey: config.BEDROCK_API_KEY,
    model: config.BEDROCK_MODEL,
    region: config.BEDROCK_REGION,
    baseUrl: config.BEDROCK_BASE_URL,
    timeoutMs: config.BEDROCK_TIMEOUT_MS,
    logger,
  });
  const limiter = new SlidingWindowRateLimiter({
    requestsPerMinute: config.GENERATION_REQUESTS_PER_MINUTE,
    tokensPerMinute: config.GENERATION_TOKENS_PER_MINUTE,
    onWait: ({ waitMs, tokenCount }) =>
      logger.info("generation.rate_limit_wait", { waitMs, tokenCount }),
  });
  const store = await new GenerationRunStore(runDir).initialize({
    retryFailed: options.retryFailed,
  });
  const summary = await runGeneration({
    jobs,
    client,
    limiter,
    store,
    maxConcurrent: config.GENERATION_MAX_CONCURRENT,
    signal: controller.signal,
    logger,
    retry: {
      maxAttempts: config.GENERATION_MAX_ATTEMPTS,
      maxDraftAttempts: config.GENERATION_MAX_DRAFT_ATTEMPTS,
      baseDelayMs: config.GENERATION_RETRY_BASE_MS,
      maxDelayMs: config.GENERATION_RETRY_MAX_MS,
      onRetry: ({ attempt, delayMs, error }) =>
        logger.warn("generation.retry", {
          attempt,
          delayMs,
          status: error.status,
          code: error.code,
        }),
      onDraftRetry: ({ draftAttempt, error }) =>
        logger.warn("generation.draft_retry", {
          draftAttempt,
          reason: error.message,
        }),
    },
  });
  process.stdout.write(`${JSON.stringify({ ...plan, ...summary }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Corpus generation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArguments, writePlan };
