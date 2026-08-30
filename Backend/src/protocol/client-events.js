const { z } = require('zod')

const requestIdSchema = z.string().uuid()

const historyEntrySchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
  })
  .strict()

const chatRequestSchema = z
  .object({
    type: z.literal('chat.request'),
    requestId: requestIdSchema,
    message: z.string().trim().min(1),
    history: z.array(historyEntrySchema).default([]),
    region: z.string().trim().min(1).nullable().default(null),
  })
  .strict()

const chatCancelSchema = z
  .object({
    type: z.literal('chat.cancel'),
    requestId: requestIdSchema,
  })
  .strict()

const clientEventSchema = z.discriminatedUnion('type', [
  chatRequestSchema,
  chatCancelSchema,
])

function parseClientEvent(payload) {
  const decoded = typeof payload === 'string' ? JSON.parse(payload) : payload
  return clientEventSchema.parse(decoded)
}

module.exports = {
  chatCancelSchema,
  chatRequestSchema,
  clientEventSchema,
  historyEntrySchema,
  parseClientEvent,
}

