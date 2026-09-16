const { z } = require("zod");

const identifier = z.string().trim().min(1);

const answerSchema = z
  .object({
    answerId: identifier,
    intent: identifier,
    scope: z.enum(["product", "category", "comparison", "general"]),
    fgmns: z.array(identifier).default([]),
    title: identifier,
    answer: identifier,
    evidenceIds: z.array(identifier).default([]),
    sourceIds: z.array(identifier).default([]),
    keywords: z.array(identifier).default([]),
    negativeTerms: z.array(identifier).default([]),
    status: z.literal("approved"),
  })
  .passthrough();

const questionSchema = z
  .object({
    questionId: identifier,
    answerId: identifier,
    text: identifier,
    normalizedText: identifier.optional(),
    intent: identifier,
    entities: z
      .object({
        fgmns: z.array(identifier).default([]),
        products: z.array(identifier).default([]),
      })
      .passthrough()
      .default({}),
    variantType: identifier,
    locale: z.string().trim().min(2).default("en"),
    status: z.literal("approved"),
  })
  .passthrough();

module.exports = { answerSchema, questionSchema };
