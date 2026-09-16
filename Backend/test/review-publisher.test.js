const assert = require("node:assert/strict");
const { mkdtemp, readFile, readdir, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildCatalogRelease } = require("../src/corpus/artifacts");
const { loadActiveRelease } = require("../src/corpus/load-release");
const { sha256, publishReviewedRelease } = require("../src/review/publisher");
const {
  buildReviewQueue,
  compileApprovedRecords,
  createPocReviewDecisions,
} = require("../src/review/workflow");

const fixturePath = path.join(__dirname, "fixtures", "catalog.json");

function generatedResult(releaseId, jobId = "product-job-1") {
  return {
    jobId,
    releaseId,
    fgmn: "71000122",
    promptVersion: "product-qa-v1",
    generatedAt: "2026-09-16T00:00:00.000Z",
    model: "test-model",
    status: "draft",
    validationStatus: "pending_review",
    draft: {
      supported: true,
      answer: {
        title: "AdapT 100 overview",
        answer: "AdapT 100 is described for hydrogen sulfide (H2S).",
        keywords: ["adapt 100", "hydrogen sulfide", "h2s"],
      },
      questions: [
        {
          text: "Tell me about AdapT 100",
          intent: "product_overview",
          variantType: "canonical",
        },
        {
          text: "What is product 71000122?",
          intent: "product_overview",
          variantType: "fgmn",
        },
        {
          text: "What is AdapT 100 used for?",
          intent: "product_application",
          variantType: "application",
        },
        {
          text: "Does AdapT 100 have product documents?",
          intent: "document_availability",
          variantType: "document",
        },
      ],
    },
  };
}

async function fixtureCorpus(context) {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), "review-release-"));
  context.after(() => rm(artifactDir, { recursive: true, force: true }));
  await buildCatalogRelease({
    sourcePath: fixturePath,
    artifactDir,
    now: new Date("2026-09-15T00:00:00.000Z"),
    expectedProductCount: 1,
  });
  return {
    artifactDir,
    corpus: await loadActiveRelease(artifactDir),
  };
}

function approve(record, overrides = {}) {
  return {
    ...record,
    decision: "approve",
    reviewer: "reviewer@example.test",
    reviewedAt: "2026-09-16T01:00:00.000Z",
    notes: "Compared with the frozen catalog evidence.",
    ...overrides,
  };
}

test("review export creates pending records and publication blocks them", async (context) => {
  const { corpus } = await fixtureCorpus(context);
  const queue = buildReviewQueue(
    [generatedResult(corpus.manifest.releaseId)],
    corpus,
  );

  assert.equal(queue.length, 1);
  assert.equal(queue[0].decision, "pending");
  assert.equal(queue[0].productName, corpus.products[0].displayName);
  assert.throws(
    () => compileApprovedRecords({ corpus, reviewRecords: queue }),
    /still pending/i,
  );
});

test("reviewed release dry-run writes nothing and activation is atomic", async (context) => {
  const { artifactDir, corpus } = await fixtureCorpus(context);
  const pointerBefore = await readFile(
    path.join(artifactDir, "current.json"),
    "utf8",
  );
  const releasesBefore = await readdir(path.join(artifactDir, "releases"));
  const queue = buildReviewQueue(
    [generatedResult(corpus.manifest.releaseId)],
    corpus,
  );
  const decisions = [approve(queue[0])];
  const now = new Date("2026-09-16T02:00:00.000Z");

  const dryRun = await publishReviewedRelease({
    artifactDir,
    corpus,
    reviewRecords: decisions,
    dryRun: true,
    activate: false,
    now,
  });
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.releaseDir, null);
  assert.deepEqual(
    await readdir(path.join(artifactDir, "releases")),
    releasesBefore,
  );
  assert.equal(
    await readFile(path.join(artifactDir, "current.json"), "utf8"),
    pointerBefore,
  );

  const published = await publishReviewedRelease({
    artifactDir,
    corpus,
    reviewRecords: decisions,
    activate: true,
    now,
  });
  assert.equal(published.activated, true);
  const active = await loadActiveRelease(artifactDir);
  assert.equal(active.manifest.releaseId, published.releaseId);
  assert.equal(active.answers.length, 1);
  assert.equal(active.questions.length, 4);
  assert.equal(active.answers[0].review.reviewer, "reviewer@example.test");
  assert.equal(active.report.reviewPromotion.approvedCount, 1);

  for (const [name, expectedHash] of Object.entries(
    active.manifest.offline.fileSha256,
  )) {
    const bytes = await readFile(path.join(active.releaseDir, name));
    assert.equal(sha256(bytes), expectedHash);
  }
});

test("replacing an existing product overview must be explicit", async (context) => {
  const { corpus } = await fixtureCorpus(context);
  const firstQueue = buildReviewQueue(
    [generatedResult(corpus.manifest.releaseId)],
    corpus,
  );
  const first = compileApprovedRecords({
    corpus,
    reviewRecords: [approve(firstQueue[0])],
  });
  const corpusWithAnswer = {
    ...corpus,
    answers: first.answers,
    questions: first.questions,
  };
  const secondQueue = buildReviewQueue(
    [generatedResult(corpus.manifest.releaseId, "product-job-2")],
    corpusWithAnswer,
  );

  assert.throws(
    () =>
      compileApprovedRecords({
        corpus: corpusWithAnswer,
        reviewRecords: [approve(secondQueue[0])],
      }),
    /replaceAnswerId/i,
  );

  const replaced = compileApprovedRecords({
    corpus: corpusWithAnswer,
    reviewRecords: [
      approve(secondQueue[0], {
        replaceAnswerId: first.answers[0].answerId,
      }),
    ],
  });
  assert.equal(replaced.answers.length, 1);
  assert.equal(replaced.questions.length, 4);
  assert.equal(replaced.replacedCount, 1);
});

test("POC review approves supported drafts and records explicit replacements", async (context) => {
  const { corpus } = await fixtureCorpus(context);
  const firstQueue = buildReviewQueue(
    [generatedResult(corpus.manifest.releaseId)],
    corpus,
  );
  const firstDecision = createPocReviewDecisions({
    corpus,
    reviewRecords: firstQueue,
    reviewer: "poc-review",
    reviewedAt: "2026-09-16T03:00:00.000Z",
  });
  const first = compileApprovedRecords({
    corpus,
    reviewRecords: firstDecision,
  });
  const corpusWithAnswer = {
    ...corpus,
    answers: first.answers,
    questions: first.questions,
  };
  const secondQueue = buildReviewQueue(
    [generatedResult(corpus.manifest.releaseId, "product-job-2")],
    corpusWithAnswer,
  );
  const decisions = createPocReviewDecisions({
    corpus: corpusWithAnswer,
    reviewRecords: secondQueue,
    reviewer: "poc-review",
    reviewedAt: "2026-09-16T04:00:00.000Z",
  });

  assert.equal(decisions[0].decision, "approve");
  assert.equal(decisions[0].reviewer, "poc-review");
  assert.equal(decisions[0].replaceAnswerId, first.answers[0].answerId);
  assert.doesNotThrow(() =>
    compileApprovedRecords({
      corpus: corpusWithAnswer,
      reviewRecords: decisions,
    }),
  );
});

test("POC review rejects unsupported and conflicting drafts", async (context) => {
  const { corpus } = await fixtureCorpus(context);
  const supported = generatedResult(corpus.manifest.releaseId);
  const conflicting = generatedResult(
    corpus.manifest.releaseId,
    "product-job-2",
  );
  const unsupported = {
    ...generatedResult(corpus.manifest.releaseId, "product-job-3"),
    status: "unsupported",
    draft: { supported: false, reason: "Insufficient evidence" },
  };
  const queue = buildReviewQueue([supported, conflicting, unsupported], corpus);
  const decisions = createPocReviewDecisions({
    corpus,
    reviewRecords: queue,
    reviewer: "poc-review",
    reviewedAt: "2026-09-16T05:00:00.000Z",
  });

  assert.deepEqual(
    decisions.map((record) => record.decision),
    ["approve", "reject", "reject"],
  );
});
