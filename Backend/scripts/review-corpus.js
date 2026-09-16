const { access, rename, writeFile } = require("node:fs/promises");
const path = require("node:path");

const { loadActiveRelease } = require("../src/corpus/load-release");
const { PROMPT_VERSION } = require("../src/generation/planner");
const { readJsonLinesIfPresent } = require("../src/generation/run-store");
const { publishReviewedRelease } = require("../src/review/publisher");
const { reviewRecordSchema } = require("../src/review/schema");
const {
  buildReviewQueue,
  createPocReviewDecisions,
} = require("../src/review/workflow");

function parseArguments(args) {
  const command = args[0];
  if (!["export", "poc-review", "publish"].includes(command)) {
    throw new Error("First argument must be export, poc-review, or publish");
  }
  const options = {
    command,
    activate: false,
    confirmPoc: false,
    dryRun: false,
    force: false,
    artifactDir: null,
    reviewer: null,
    runDir: null,
    reviewFile: null,
  };
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--activate") options.activate = true;
    else if (argument === "--confirm-poc") options.confirmPoc = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--force") options.force = true;
    else if (argument === "--artifact-dir") {
      options.artifactDir = args[++index];
    } else if (argument.startsWith("--artifact-dir=")) {
      options.artifactDir = argument.slice("--artifact-dir=".length);
    } else if (argument === "--run-dir") options.runDir = args[++index];
    else if (argument.startsWith("--run-dir=")) {
      options.runDir = argument.slice("--run-dir=".length);
    } else if (argument === "--review-file") {
      options.reviewFile = args[++index];
    } else if (argument.startsWith("--review-file=")) {
      options.reviewFile = argument.slice("--review-file=".length);
    } else if (argument === "--reviewer") {
      options.reviewer = args[++index];
    } else if (argument.startsWith("--reviewer=")) {
      options.reviewer = argument.slice("--reviewer=".length);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.dryRun && options.activate) {
    throw new Error("--dry-run and --activate cannot be combined");
  }
  return options;
}

async function writeJsonLinesAtomic(filePath, records) {
  const temporaryPath = `${filePath}.tmp`;
  const text =
    records.length > 0
      ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
      : "";
  await writeFile(temporaryPath, text, "utf8");
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
  const runDir = path.resolve(
    options.runDir ||
      path.join(
        artifactDir,
        "generation-runs",
        `${corpus.manifest.releaseId}-${PROMPT_VERSION}`,
      ),
  );
  const reviewFile = path.resolve(
    options.reviewFile || path.join(runDir, "review-queue.jsonl"),
  );

  if (options.command === "export") {
    if (!options.force) {
      try {
        await access(reviewFile);
        throw new Error(
          `Review file already exists; use --force to replace it: ${reviewFile}`,
        );
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    const results = await readJsonLinesIfPresent(
      path.join(runDir, "raw-results.jsonl"),
    );
    const queue = buildReviewQueue(results, corpus);
    await writeJsonLinesAtomic(reviewFile, queue);
    process.stdout.write(
      `${JSON.stringify({ reviewFile, recordCount: queue.length }, null, 2)}\n`,
    );
    return;
  }

  if (options.command === "poc-review") {
    if (!options.confirmPoc) {
      throw new Error("POC review requires the explicit --confirm-poc flag");
    }
    if (!options.reviewer?.trim()) {
      throw new Error("POC review requires --reviewer");
    }
    const pendingRecords = await readJsonLinesIfPresent(reviewFile);
    if (pendingRecords.length === 0) {
      throw new Error("The review file contains no decisions");
    }
    const decisions = createPocReviewDecisions({
      corpus,
      reviewRecords: pendingRecords,
      reviewer: options.reviewer,
    });
    await writeJsonLinesAtomic(reviewFile, decisions);
    process.stdout.write(
      `${JSON.stringify(
        {
          reviewFile,
          recordCount: decisions.length,
          approvedCount: decisions.filter(
            (record) => record.decision === "approve",
          ).length,
          rejectedCount: decisions.filter(
            (record) => record.decision === "reject",
          ).length,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  const reviewRecords = (await readJsonLinesIfPresent(reviewFile)).map(
    (record) => reviewRecordSchema.parse(record),
  );
  if (reviewRecords.length === 0) {
    throw new Error("The review file contains no decisions");
  }
  const result = await publishReviewedRelease({
    artifactDir,
    corpus,
    reviewRecords,
    dryRun: options.dryRun,
    activate: options.activate,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        releaseId: result.releaseId,
        releaseDir: result.releaseDir,
        dryRun: result.dryRun,
        activated: result.activated,
        approvedCount: result.compiled.approvedCount,
        rejectedCount: result.compiled.rejectedCount,
        replacedCount: result.compiled.replacedCount,
        answerCount: result.compiled.answers.length,
        questionCount: result.compiled.questions.length,
      },
      null,
      2,
    )}\n`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Corpus review failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArguments, writeJsonLinesAtomic };
