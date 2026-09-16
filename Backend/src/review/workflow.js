const { createHash } = require("node:crypto");

const { validateOfflineReferences } = require("../corpus/load-release");
const { normalizeQuery } = require("../offline/normalization");
const { answerSchema, questionSchema } = require("../offline/schema");
const { reviewRecordSchema } = require("./schema");

function shortHash(value, length = 12) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function buildReviewQueue(results, corpus) {
  const productsByFgmn = new Map(
    corpus.products.map((product) => [String(product.fgmn), product]),
  );
  const seenJobs = new Set();
  return results.map((result) => {
    if (seenJobs.has(result.jobId)) {
      throw new Error(`Duplicate generation result for job ${result.jobId}`);
    }
    seenJobs.add(result.jobId);
    if (result.releaseId !== corpus.manifest.releaseId) {
      throw new Error(
        `Generation result ${result.jobId} belongs to release ${result.releaseId}`,
      );
    }
    const product = productsByFgmn.get(String(result.fgmn));
    if (!product) {
      throw new Error(
        `Generation result ${result.jobId} references unknown FGMN ${result.fgmn}`,
      );
    }
    return reviewRecordSchema.parse({
      jobId: result.jobId,
      releaseId: result.releaseId,
      fgmn: String(result.fgmn),
      productName: product.displayName,
      model: result.model || null,
      promptVersion: result.promptVersion,
      generatedAt: result.generatedAt,
      draft: result.draft,
      currentAnswerIds: corpus.answers
        .filter((answer) =>
          answer.fgmns.map(String).includes(String(result.fgmn)),
        )
        .map((answer) => answer.answerId),
      decision: "pending",
      reviewer: null,
      reviewedAt: null,
      notes: "",
      editedDraft: null,
      replaceAnswerId: null,
    });
  });
}

function sourcesForProduct(product) {
  const sources = [`product:${product.fgmn}`];
  if (product.documents?.hasTds) sources.push(`tds:${product.fgmn}`);
  if (product.documents?.hasSds) sources.push(`sds:${product.fgmn}`);
  return sources;
}

function createPocReviewDecisions({
  corpus,
  reviewRecords,
  reviewer,
  reviewedAt = new Date().toISOString(),
}) {
  if (typeof reviewer !== "string" || reviewer.trim() === "") {
    throw new Error("A reviewer is required for POC review decisions");
  }
  const normalizedQuestionOwners = new Map(
    corpus.questions.map((question) => [
      normalizeQuery(question.normalizedText || question.text),
      question.answerId,
    ]),
  );
  const acceptedQuestionOwners = new Map();

  return reviewRecords.map((value) => {
    const record = reviewRecordSchema.parse(value);
    const completed = {
      ...record,
      reviewer: reviewer.trim(),
      reviewedAt,
      editedDraft: null,
      replaceAnswerId: null,
    };
    if (!record.draft.supported) {
      return reviewRecordSchema.parse({
        ...completed,
        decision: "reject",
        notes:
          "POC automated review: unsupported by the frozen catalog evidence.",
      });
    }

    const existingOverviews = corpus.answers.filter(
      (answer) =>
        answer.intent === "product_overview" &&
        answer.fgmns.map(String).includes(String(record.fgmn)),
    );
    if (existingOverviews.length > 1) {
      return reviewRecordSchema.parse({
        ...completed,
        decision: "reject",
        notes:
          "POC automated review: multiple existing product overviews require manual resolution.",
      });
    }
    const replaceAnswerId = existingOverviews[0]?.answerId || null;
    const normalizedQuestions = record.draft.questions.map((question) =>
      normalizeQuery(question.text),
    );
    const conflict = normalizedQuestions.find((normalized) => {
      const existingOwner = normalizedQuestionOwners.get(normalized);
      return (
        (existingOwner && existingOwner !== replaceAnswerId) ||
        acceptedQuestionOwners.has(normalized)
      );
    });
    if (conflict) {
      return reviewRecordSchema.parse({
        ...completed,
        decision: "reject",
        notes:
          "POC automated review: normalized question conflicts with another answer.",
      });
    }
    for (const normalized of normalizedQuestions) {
      acceptedQuestionOwners.set(normalized, record.jobId);
    }
    return reviewRecordSchema.parse({
      ...completed,
      decision: "approve",
      notes:
        "POC automated review: passed generation schema, evidence, reference, and conflict checks.",
      replaceAnswerId,
    });
  });
}

function compileApprovedRecords({ corpus, reviewRecords }) {
  const records = reviewRecords.map((record) =>
    reviewRecordSchema.parse(record),
  );
  const pending = records.filter((record) => record.decision === "pending");
  if (pending.length > 0) {
    throw new Error(
      `${pending.length} review decisions are still pending; publication is blocked`,
    );
  }
  const jobIds = new Set();
  for (const record of records) {
    if (jobIds.has(record.jobId)) {
      throw new Error(`Duplicate review decision for job ${record.jobId}`);
    }
    jobIds.add(record.jobId);
    if (record.releaseId !== corpus.manifest.releaseId) {
      throw new Error(
        `Review decision ${record.jobId} targets a different base release`,
      );
    }
  }

  const productsByFgmn = new Map(
    corpus.products.map((product) => [String(product.fgmn), product]),
  );
  const removedAnswerIds = new Set();
  const additions = [];
  for (const record of records) {
    if (record.decision === "reject") continue;
    const product = productsByFgmn.get(String(record.fgmn));
    if (!product) throw new Error(`Unknown reviewed FGMN ${record.fgmn}`);
    const draft =
      record.decision === "edit" ? record.editedDraft : record.draft;
    if (!draft?.supported) {
      throw new Error(`Reviewed job ${record.jobId} has no supported draft`);
    }
    const existingForIntent = corpus.answers.filter(
      (answer) =>
        answer.intent === "product_overview" &&
        answer.fgmns.map(String).includes(String(record.fgmn)),
    );
    if (existingForIntent.length > 0) {
      if (!record.replaceAnswerId) {
        throw new Error(
          `Reviewed job ${record.jobId} must name replaceAnswerId for the existing product overview`,
        );
      }
      if (
        !existingForIntent.some(
          (answer) => answer.answerId === record.replaceAnswerId,
        )
      ) {
        throw new Error(
          `replaceAnswerId ${record.replaceAnswerId} does not match the existing product overview`,
        );
      }
      removedAnswerIds.add(record.replaceAnswerId);
    } else if (record.replaceAnswerId) {
      throw new Error(
        `replaceAnswerId ${record.replaceAnswerId} does not exist for ${record.fgmn}`,
      );
    }

    const answerId = `product:${record.fgmn}:product_overview:${shortHash(record.jobId)}`;
    const answer = answerSchema.parse({
      answerId,
      intent: "product_overview",
      scope: "product",
      fgmns: [String(record.fgmn)],
      title: draft.answer.title,
      answer: draft.answer.answer,
      evidenceIds: [`catalog:${record.fgmn}`],
      sourceIds: sourcesForProduct(product),
      keywords: draft.answer.keywords,
      negativeTerms: [],
      status: "approved",
      review: {
        reviewer: record.reviewer,
        reviewedAt: record.reviewedAt,
        notes: record.notes,
      },
      provenance: {
        generationJobId: record.jobId,
        model: record.model,
        promptVersion: record.promptVersion,
      },
    });
    const questions = draft.questions.map((question) => {
      const normalizedText = normalizeQuery(question.text);
      return questionSchema.parse({
        questionId: `q:${record.fgmn}:${shortHash(`${answerId}\n${normalizedText}`)}`,
        answerId,
        text: question.text,
        normalizedText,
        intent: question.intent,
        entities: {
          fgmns: [String(record.fgmn)],
          products: [normalizeQuery(product.displayName)],
        },
        variantType: question.variantType,
        locale: "en",
        status: "approved",
      });
    });
    additions.push({ answer, questions });
  }

  const answers = corpus.answers.filter(
    (answer) => !removedAnswerIds.has(answer.answerId),
  );
  const questions = corpus.questions.filter(
    (question) => !removedAnswerIds.has(question.answerId),
  );
  for (const addition of additions) {
    answers.push(addition.answer);
    questions.push(...addition.questions);
  }
  validateOfflineReferences(corpus.products, answers, questions);

  const intentKeys = new Set();
  for (const answer of answers) {
    for (const fgmn of answer.fgmns) {
      const key = `${fgmn}\n${answer.intent}`;
      if (intentKeys.has(key)) {
        throw new Error(
          `Duplicate approved answer scope for ${fgmn}/${answer.intent}`,
        );
      }
      intentKeys.add(key);
    }
  }

  return {
    answers,
    questions,
    approvedCount: additions.length,
    rejectedCount: records.filter((record) => record.decision === "reject")
      .length,
    replacedCount: removedAnswerIds.size,
  };
}

module.exports = {
  buildReviewQueue,
  compileApprovedRecords,
  createPocReviewDecisions,
  shortHash,
  sourcesForProduct,
};
