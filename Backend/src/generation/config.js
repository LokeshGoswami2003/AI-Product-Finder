const { z } = require("zod");

const positiveInteger = (defaultValue) =>
  z.coerce.number().int().positive().default(defaultValue);

const generationEnvSchema = z.object({
  BEDROCK_API_KEY: z.string().min(20),
  BEDROCK_MODEL: z.string().min(1).default("deepseek.v3.2"),
  BEDROCK_REGION: z.string().min(1).default("ap-south-1"),
  BEDROCK_BASE_URL: z.string().url().optional(),
  BEDROCK_TIMEOUT_MS: positiveInteger(120000),
  GENERATION_MAX_CONCURRENT: positiveInteger(3),
  GENERATION_REQUESTS_PER_MINUTE: positiveInteger(90),
  GENERATION_TOKENS_PER_MINUTE: positiveInteger(180000),
  GENERATION_MAX_ATTEMPTS: positiveInteger(5),
  GENERATION_MAX_DRAFT_ATTEMPTS: positiveInteger(2),
  GENERATION_RETRY_BASE_MS: positiveInteger(1000),
  GENERATION_RETRY_MAX_MS: positiveInteger(60000),
  GENERATION_MAX_OUTPUT_TOKENS: positiveInteger(1200),
});

function parseGenerationEnv(environment = process.env) {
  const parsed = generationEnvSchema.parse(environment);
  if (parsed.GENERATION_MAX_CONCURRENT > 10) {
    throw new Error("GENERATION_MAX_CONCURRENT must not exceed 10");
  }
  if (parsed.GENERATION_RETRY_BASE_MS > parsed.GENERATION_RETRY_MAX_MS) {
    throw new Error(
      "GENERATION_RETRY_BASE_MS must not exceed GENERATION_RETRY_MAX_MS",
    );
  }
  return parsed;
}

module.exports = { generationEnvSchema, parseGenerationEnv };
