const { normalizeQuery } = require("../offline/normalization");
const { buildGenerationMessages } = require("./prompts");
const { withRetry } = require("./retry");
const { generatedPackageSchema } = require("./schema");

class GenerationDraftError extends Error {
  constructor(message, { rawText, model = null, usage = null, cause } = {}) {
    super(message, { cause });
    this.name = "GenerationDraftError";
    this.rawText = rawText;
    this.model = model;
    this.usage = usage;
  }
}

function extractJsonObject(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The generation response did not contain a JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function validateDraft(job, value) {
  const draft = generatedPackageSchema.parse(value);
  if (!draft.supported) return draft;
  const serialized = JSON.stringify(draft);
  if (/https?:\/\//i.test(serialized) || /<\/?[a-z][^>]*>/i.test(serialized)) {
    throw new Error("Generated drafts must not contain URLs or HTML");
  }
  const evidenceNumbers = new Set(
    JSON.stringify(job.product).match(/\b\d+(?:\.\d+)?\b/g) || [],
  );
  const generatedNumbers = serialized.match(/\b\d+(?:\.\d+)?\b/g) || [];
  const unsupportedNumber = generatedNumbers.find(
    (number) => !evidenceNumbers.has(number),
  );
  if (unsupportedNumber) {
    throw new Error(
      `Generated draft introduced unsupported number ${unsupportedNumber}`,
    );
  }
  const normalizedQuestions = new Set();
  for (const question of draft.questions) {
    const normalized = normalizeQuery(question.text);
    if (normalizedQuestions.has(normalized)) {
      throw new Error(
        `Generated draft contains duplicate question: ${normalized}`,
      );
    }
    normalizedQuestions.add(normalized);
  }
  return draft;
}

function safeError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || "Unknown generation failure",
    status: error?.status ?? null,
    code: error?.code ?? null,
  };
}

function isFatalGenerationError(error) {
  return error?.name === "BedrockError" && [401, 403].includes(error.status);
}

async function generateJob({ job, client, limiter, retry, signal }) {
  const reservedTokens = job.estimatedInputTokens + job.maxOutputTokens;
  const startedAt = Date.now();
  let completion;
  let draft;
  let rawText;
  let attempts = 0;
  const maxDraftAttempts = retry.maxDraftAttempts || 2;
  for (
    let draftAttempt = 1;
    draftAttempt <= maxDraftAttempts;
    draftAttempt += 1
  ) {
    const transport = await withRetry(
      async () => {
        await limiter.acquire(reservedTokens, signal);
        return client.createChatCompletion({
          messages: buildGenerationMessages(job),
          signal,
          responseFormat: { type: "json_object" },
          maxTokens: job.maxOutputTokens,
        });
      },
      { ...retry, signal },
    );
    completion = transport.value;
    attempts += transport.attempts;
    rawText = completion?.choices?.[0]?.message?.content;
    try {
      draft = validateDraft(job, extractJsonObject(rawText));
      break;
    } catch (error) {
      if (draftAttempt >= maxDraftAttempts) {
        throw new GenerationDraftError(error.message, {
          rawText,
          model: completion.model || null,
          usage: completion.usage || null,
          cause: error,
        });
      }
      retry.onDraftRetry?.({ draftAttempt, error });
    }
  }
  return {
    jobId: job.jobId,
    releaseId: job.releaseId,
    fgmn: job.fgmn,
    promptVersion: job.promptVersion,
    generatedAt: new Date().toISOString(),
    status: draft.supported ? "draft" : "unsupported",
    attempts,
    latencyMs: Date.now() - startedAt,
    reservedTokens,
    usage: completion.usage || null,
    model: completion.model || null,
    rawText,
    draft,
    validationStatus: "pending_review",
  };
}

async function runGeneration({
  jobs,
  client,
  limiter,
  store,
  maxConcurrent = 1,
  retry,
  signal,
  logger,
}) {
  const pending = jobs.filter((job) => !store.isComplete(job.jobId));
  let nextIndex = 0;
  let fatalError = null;
  async function worker() {
    while (!fatalError && nextIndex < pending.length) {
      const job = pending[nextIndex];
      nextIndex += 1;
      try {
        const record = await generateJob({
          job,
          client,
          limiter,
          retry,
          signal,
        });
        await store.appendResult(record, jobs.length);
        logger?.info("generation.job_completed", {
          jobId: job.jobId,
          fgmn: job.fgmn,
          status: record.status,
          attempts: record.attempts,
        });
      } catch (error) {
        if (signal?.aborted || error?.name === "AbortError") throw error;
        await store.appendQuarantine(
          {
            jobId: job.jobId,
            releaseId: job.releaseId,
            fgmn: job.fgmn,
            failedAt: new Date().toISOString(),
            error: safeError(error),
            ...(typeof error.rawText === "string"
              ? {
                  rawText: error.rawText,
                  model: error.model,
                  usage: error.usage,
                }
              : {}),
          },
          jobs.length,
        );
        logger?.error("generation.job_quarantined", {
          jobId: job.jobId,
          fgmn: job.fgmn,
          error,
        });
        if (isFatalGenerationError(error)) {
          fatalError = error;
          throw error;
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrent, pending.length) }, () =>
      worker(),
    ),
  );
  return {
    totalJobs: jobs.length,
    skippedJobs: jobs.length - pending.length,
    attemptedJobs: pending.length,
    succeeded: store.succeeded,
    unsupported: store.unsupported,
    quarantined: store.quarantined,
    totalTokens: store.totalTokens,
  };
}

module.exports = {
  GenerationDraftError,
  extractJsonObject,
  generateJob,
  isFatalGenerationError,
  runGeneration,
  safeError,
  validateDraft,
};
