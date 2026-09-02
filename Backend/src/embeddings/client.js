class EmbeddingClientError extends Error {
  constructor(message, { status = null, code = null, retryable = false } = {}) {
    super(message);
    this.name = "EmbeddingClientError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function validateEmbedding(vector, expectedDimensions, name) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new TypeError(`${name} must be a non-empty array`);
  }
  if (!vector.every(Number.isFinite)) {
    throw new TypeError(`${name} must contain only finite numbers`);
  }
  if (expectedDimensions && vector.length !== expectedDimensions) {
    throw new TypeError(
      `${name} must contain exactly ${expectedDimensions} dimensions`,
    );
  }
  return vector;
}

class EmbeddingClient {
  constructor({
    apiKey,
    model,
    baseUrl = "https://ai-gateway.vercel.sh/v1",
    batchSize = 64,
    timeoutMs = 30_000,
    expectedDimensions,
    fetchImpl = fetch,
  }) {
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      throw new TypeError("An embedding API key is required");
    }
    if (typeof model !== "string" || model.trim() === "") {
      throw new TypeError("An embedding model is required");
    }
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new TypeError("Embedding batch size must be a positive integer");
    }

    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.batchSize = batchSize;
    this.timeoutMs = timeoutMs;
    this.expectedDimensions = expectedDimensions;
    this.fetchImpl = fetchImpl;
  }

  async embed(text, options = {}) {
    const [embedding] = await this.embedBatch([text], options);
    return embedding;
  }

  async embedBatch(texts, { signal } = {}) {
    if (
      !Array.isArray(texts) ||
      texts.length === 0 ||
      texts.some((text) => typeof text !== "string" || text.trim() === "")
    ) {
      throw new TypeError("Embedding inputs must be a non-empty array of text");
    }

    const embeddings = [];
    for (let offset = 0; offset < texts.length; offset += this.batchSize) {
      const batch = texts.slice(offset, offset + this.batchSize);
      embeddings.push(...(await this.#requestBatch(batch, signal)));
    }
    return embeddings;
  }

  async #requestBatch(input, signal) {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), this.timeoutMs);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input,
          encoding_format: "float",
          ...(this.expectedDimensions
            ? { dimensions: this.expectedDimensions }
            : {}),
        }),
        signal: requestSignal,
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new EmbeddingClientError(
          body?.error?.message ||
            `Embedding request failed with status ${response.status}`,
          {
            status: response.status,
            code: body?.error?.code || null,
            retryable: response.status === 429 || response.status >= 500,
          },
        );
      }

      if (!Array.isArray(body?.data) || body.data.length !== input.length) {
        throw new EmbeddingClientError(
          "Embedding response count does not match the input count",
        );
      }

      return [...body.data]
        .sort((left, right) => left.index - right.index)
        .map((entry, index) =>
          validateEmbedding(
            entry.embedding,
            this.expectedDimensions,
            `Embedding ${index}`,
          ),
        );
    } catch (error) {
      if (error instanceof EmbeddingClientError || error instanceof TypeError) {
        throw error;
      }
      if (timeoutController.signal.aborted && !signal?.aborted) {
        throw new EmbeddingClientError("Embedding request timed out", {
          retryable: true,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = {
  EmbeddingClient,
  EmbeddingClientError,
  validateEmbedding,
};
