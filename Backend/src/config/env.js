const { z } = require('zod')

const positiveInteger = (defaultValue) =>
  z.coerce.number().int().positive().default(defaultValue)

const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
)

const commaSeparatedSecrets = z
  .string()
  .transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
  .pipe(z.array(z.string().min(20)).min(1))

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_ORIGIN: z.string().url(),
    MVP_ACCESS_CODE: z.string().min(8),
    COOKIE_SIGNING_SECRET: z.string().min(32),
    AUTH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('product_finder_session'),
    AUTH_TTL_SECONDS: positiveInteger(3600),
    AI_PROVIDER: z.enum(['openrouter', 'bedrock']).default('openrouter'),
    OPENROUTER_API_KEYS: commaSeparatedSecrets.optional(),
    OPENROUTER_MODEL: z.string().min(1).default('openrouter/free'),
    OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
    OPENROUTER_APP_NAME: z.string().min(1).default('AI Product Finder'),
    OPENROUTER_SITE_URL: z.string().url().optional(),
    AWS_REGION: optionalString,
    BEDROCK_CHAT_MODEL_ID: optionalString,
    BEDROCK_EMBEDDING_MODEL_ID: z
      .string()
      .min(1)
      .default('amazon.titan-embed-text-v2:0'),
    BEDROCK_EMBEDDING_DIMENSIONS: z.coerce
      .number()
      .int()
      .refine((value) => [256, 512, 1024].includes(value), {
        message: 'Must be 256, 512, or 1024',
      })
      .default(1024),
    BEDROCK_MAX_TOKENS: positiveInteger(1024),
    BEDROCK_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.1),
    BEDROCK_REQUEST_TIMEOUT_MS: positiveInteger(60000),
    BEDROCK_GUARDRAIL_ID: optionalString,
    BEDROCK_GUARDRAIL_VERSION: optionalString,
    BEDROCK_EXPECTED_RETENTION_MODE: z.literal('none'),
    EASTMAN_PRODUCT_FINDER_URL: z.string().url(),
    CORPUS_ARTIFACT_DIR: z.string().min(1).default('./artifacts'),
    CORPUS_WARN_AGE_HOURS: positiveInteger(48),
    INGEST_CONCURRENCY: positiveInteger(4),
    INGEST_TIMEOUT_MS: positiveInteger(30000),
    CHAT_MAX_MESSAGE_CHARS: positiveInteger(4000),
    CHAT_MAX_HISTORY_TURNS: positiveInteger(10),
    CHAT_MAX_HISTORY_CHARS: positiveInteger(20000),
    WS_MAX_PAYLOAD_BYTES: positiveInteger(32768),
    WS_HEARTBEAT_MS: positiveInteger(30000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, context) => {
    if (env.AI_PROVIDER === 'openrouter' && !env.OPENROUTER_API_KEYS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OPENROUTER_API_KEYS'],
        message: 'At least one OpenRouter API key is required',
      })
    }

    if (env.AI_PROVIDER === 'bedrock') {
      for (const field of ['AWS_REGION', 'BEDROCK_CHAT_MODEL_ID']) {
        if (!env[field]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required for the Bedrock provider`,
          })
        }
      }
    }

    const hasGuardrailId = Boolean(env.BEDROCK_GUARDRAIL_ID)
    const hasGuardrailVersion = Boolean(env.BEDROCK_GUARDRAIL_VERSION)

    if (hasGuardrailId !== hasGuardrailVersion) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasGuardrailId ? ['BEDROCK_GUARDRAIL_VERSION'] : ['BEDROCK_GUARDRAIL_ID'],
        message: 'Guardrail ID and version must be configured together',
      })
    }
  })

function parseEnv(environment = process.env) {
  return envSchema.parse(environment)
}

module.exports = { envSchema, parseEnv }
