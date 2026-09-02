const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EmbeddingClient,
  EmbeddingClientError,
} = require("../src/embeddings/client");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test("embedding client batches inputs and restores response index order", async () => {
  const requests = [];
  const client = new EmbeddingClient({
    apiKey: "embedding-key",
    model: "provider/embedding-model",
    batchSize: 2,
    expectedDimensions: 2,
    fetchImpl: async (url, options) => {
      const payload = JSON.parse(options.body);
      requests.push({ url, payload });
      return response(200, {
        data: payload.input
          .map((_text, index) => ({ index, embedding: [index + 1, 0] }))
          .reverse(),
      });
    },
  });

  const embeddings = await client.embedBatch(["one", "two", "three"]);

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://ai-gateway.vercel.sh/v1/embeddings");
  assert.deepEqual(requests[0].payload, {
    model: "provider/embedding-model",
    input: ["one", "two"],
    encoding_format: "float",
    dimensions: 2,
  });
  assert.deepEqual(embeddings, [
    [1, 0],
    [2, 0],
    [1, 0],
  ]);
});

test("embedding client validates dimensions and classifies provider errors", async () => {
  const invalidClient = new EmbeddingClient({
    apiKey: "embedding-key",
    model: "provider/embedding-model",
    expectedDimensions: 3,
    fetchImpl: async () =>
      response(200, { data: [{ index: 0, embedding: [1, 0] }] }),
  });
  await assert.rejects(invalidClient.embed("query"), /exactly 3 dimensions/);

  const rateLimitedClient = new EmbeddingClient({
    apiKey: "embedding-key",
    model: "provider/embedding-model",
    fetchImpl: async () =>
      response(429, { error: { message: "Rate limited", code: "rate_limit" } }),
  });
  await assert.rejects(
    rateLimitedClient.embed("query"),
    (error) =>
      error instanceof EmbeddingClientError &&
      error.status === 429 &&
      error.retryable === true,
  );
});
