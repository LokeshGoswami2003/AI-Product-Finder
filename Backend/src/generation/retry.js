const { BedrockError } = require("../bedrock/client");
const { sleep } = require("./rate-limiter");

function isRetryableGenerationError(error) {
  if (!(error instanceof BedrockError)) return false;
  return (
    error.status === null ||
    error.status === 408 ||
    error.status === 429 ||
    error.status >= 500
  );
}

async function withRetry(
  operation,
  {
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    signal,
    random = Math.random,
    sleepImpl = sleep,
    onRetry = () => {},
  },
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return { value: await operation(attempt), attempts: attempt };
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw error;
      if (attempt >= maxAttempts || !isRetryableGenerationError(error)) {
        throw error;
      }
      const exponential = Math.min(
        maxDelayMs,
        baseDelayMs * 2 ** (attempt - 1),
      );
      const jittered = Math.max(1, Math.round(exponential * (0.5 + random())));
      const delayMs = Math.max(jittered, error.retryAfterMs || 0);
      onRetry({ attempt, delayMs, error });
      await sleepImpl(delayMs, signal);
    }
  }
  throw new Error("Retry loop exited unexpectedly");
}

module.exports = { isRetryableGenerationError, withRetry };
