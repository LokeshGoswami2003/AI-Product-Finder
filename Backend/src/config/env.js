const { z } = require('zod')

const positiveInteger = (defaultValue) =>
  z.coerce.number().int().positive().default(defaultValue)

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_ORIGIN: z.string().url(),
    MVP_ACCESS_CODE: z.string().min(8),
    COOKIE_SIGNING_SECRET: z.string().min(32),
    AUTH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('product_finder_session'),
    AUTH_TTL_SECONDS: positiveInteger(3600),
    AI_PROVIDER: z.literal('vercel').default('vercel'),
    VERCEL_AI_GATEWAY_API_KEY: z.string().min(20).optional(),
    VERCEL_AI_GATEWAY_MODEL: z.string().min(1).default('zai/glm-5.3-flash'),
    VERCEL_AI_GATEWAY_BASE_URL: z
      .string()
      .url()
      .default('https://ai-gateway.vercel.sh/v1'),
    EASTMAN_PRODUCT_FINDER_URL: z.string().url(),
    CORPUS_ARTIFACT_DIR: z.string().min(1).default('./artifacts'),
    CORPUS_WARN_AGE_HOURS: positiveInteger(48),
    INGEST_CONCURRENCY: positiveInteger(4),
    INGEST_TIMEOUT_MS: positiveInteger(30000),
    CHAT_MAX_MESSAGE_CHARS: positiveInteger(4000),
    CHAT_MAX_HISTORY_TURNS: positiveInteger(10),
    CHAT_MAX_HISTORY_CHARS: positiveInteger(20000),
    DOCUMENT_FETCH_TIMEOUT_MS: positiveInteger(15000),
    DOCUMENT_CACHE_TTL_SECONDS: positiveInteger(3600),
    WS_MAX_PAYLOAD_BYTES: positiveInteger(32768),
    WS_HEARTBEAT_MS: positiveInteger(30000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, context) => {
    if (env.AI_PROVIDER === 'vercel' && !env.VERCEL_AI_GATEWAY_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['VERCEL_AI_GATEWAY_API_KEY'],
        message: 'A Vercel AI Gateway API key is required',
      })
    }

  })

function parseEnv(environment = process.env) {
  return envSchema.parse(environment)
}

module.exports = { envSchema, parseEnv }
