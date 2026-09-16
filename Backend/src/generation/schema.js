const { z } = require("zod");

const identifier = z.string().trim().min(1);

const generationJobSchema = z.object({
  jobId: identifier,
  releaseId: identifier,
  taskType: z.literal("product_qa"),
  promptVersion: identifier,
  fgmn: identifier,
  evidenceIds: z.array(identifier).min(1),
  product: z.object({
    fgmn: identifier,
    displayName: identifier,
    description: identifier,
    documents: z.object({
      hasTds: z.boolean().default(false),
      hasSds: z.boolean().default(false),
      hasSalesSpecification: z.boolean().default(false),
    }),
  }),
  estimatedInputTokens: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
});

const supportedDraftSchema = z.object({
  supported: z.literal(true),
  answer: z.object({
    title: identifier.max(160),
    answer: identifier.max(5000),
    keywords: z.array(identifier.max(100)).min(3).max(20),
  }),
  questions: z
    .array(
      z.object({
        text: identifier.max(300),
        intent: z.enum([
          "product_overview",
          "product_application",
          "product_feature",
          "document_availability",
        ]),
        variantType: z.enum([
          "canonical",
          "paraphrase",
          "application",
          "document",
          "fgmn",
        ]),
      }),
    )
    .min(4)
    .max(12),
});

const unsupportedDraftSchema = z.object({
  supported: z.literal(false),
  reason: identifier.max(500),
});

const generatedPackageSchema = z.discriminatedUnion("supported", [
  supportedDraftSchema,
  unsupportedDraftSchema,
]);

module.exports = {
  generatedPackageSchema,
  generationJobSchema,
  supportedDraftSchema,
  unsupportedDraftSchema,
};
