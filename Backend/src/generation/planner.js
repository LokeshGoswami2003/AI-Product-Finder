const { createHash } = require("node:crypto");

const { generationJobSchema } = require("./schema");

const PROMPT_VERSION = "product-qa-v2";

function estimateTokens(value) {
  return Math.max(1, Math.ceil(JSON.stringify(value).length / 4));
}

function stableJobId(releaseId, fgmn, promptVersion = PROMPT_VERSION) {
  const digest = createHash("sha256")
    .update(`${releaseId}\n${fgmn}\n${promptVersion}`)
    .digest("hex")
    .slice(0, 16);
  return `product-qa:${fgmn}:${digest}`;
}

function createGenerationJobs({
  manifest,
  products,
  promptVersion = PROMPT_VERSION,
  maxOutputTokens = 1200,
}) {
  return products.map((product) => {
    const evidence = {
      fgmn: String(product.fgmn),
      displayName: product.displayName,
      description: product.description,
      documents: {
        hasTds: Boolean(product.documents?.hasTds),
        hasSds: Boolean(product.documents?.hasSds),
        hasSalesSpecification: Boolean(
          product.documents?.hasSalesSpecification,
        ),
      },
    };
    return generationJobSchema.parse({
      jobId: stableJobId(manifest.releaseId, product.fgmn, promptVersion),
      releaseId: manifest.releaseId,
      taskType: "product_qa",
      promptVersion,
      fgmn: String(product.fgmn),
      evidenceIds: [`catalog:${product.fgmn}`],
      product: evidence,
      estimatedInputTokens: estimateTokens(evidence) + 500,
      maxOutputTokens,
    });
  });
}

function summarizePlan(jobs) {
  return {
    jobCount: jobs.length,
    estimatedInputTokens: jobs.reduce(
      (total, job) => total + job.estimatedInputTokens,
      0,
    ),
    reservedOutputTokens: jobs.reduce(
      (total, job) => total + job.maxOutputTokens,
      0,
    ),
  };
}

module.exports = {
  PROMPT_VERSION,
  createGenerationJobs,
  estimateTokens,
  stableJobId,
  summarizePlan,
};
