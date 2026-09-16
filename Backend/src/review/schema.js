const { z } = require("zod");

const {
  supportedDraftSchema,
  unsupportedDraftSchema,
} = require("../generation/schema");

const identifier = z.string().trim().min(1);

const reviewRecordSchema = z
  .object({
    jobId: identifier,
    releaseId: identifier,
    fgmn: identifier,
    productName: identifier,
    model: z.string().nullable(),
    promptVersion: identifier,
    generatedAt: z.string().datetime(),
    draft: z.union([supportedDraftSchema, unsupportedDraftSchema]),
    currentAnswerIds: z.array(identifier).default([]),
    decision: z.enum(["pending", "approve", "edit", "reject"]),
    reviewer: z.string().trim().nullable().default(null),
    reviewedAt: z.string().datetime().nullable().default(null),
    notes: z.string().max(2000).default(""),
    editedDraft: supportedDraftSchema.nullable().default(null),
    replaceAnswerId: identifier.nullable().default(null),
  })
  .superRefine((record, context) => {
    if (["approve", "edit", "reject"].includes(record.decision)) {
      if (!record.reviewer) {
        context.addIssue({
          code: "custom",
          path: ["reviewer"],
          message: "A reviewer is required for a completed decision",
        });
      }
      if (!record.reviewedAt) {
        context.addIssue({
          code: "custom",
          path: ["reviewedAt"],
          message: "A review timestamp is required for a completed decision",
        });
      }
    }
    if (record.decision === "edit" && !record.editedDraft) {
      context.addIssue({
        code: "custom",
        path: ["editedDraft"],
        message: "An edited draft is required for an edit decision",
      });
    }
    if (record.decision === "approve" && !record.draft.supported) {
      context.addIssue({
        code: "custom",
        path: ["decision"],
        message: "An unsupported draft cannot be approved",
      });
    }
  });

module.exports = { reviewRecordSchema };
