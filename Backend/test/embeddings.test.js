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

test("embedding client fails over once and keeps using the backup for later batches", async () => {
  const authorizationHeaders = [];
  const client = new EmbeddingClient({
    apiKey: "primary-embedding-key",
    backupApiKey: "backup-embedding-key",
    model: "provider/embedding-model",
    batchSize: 1,
    expectedDimensions: 2,
    fetchImpl: async (_url, options) => {
      authorizationHeaders.push(options.headers.Authorization);
      if (options.headers.Authorization === "Bearer primary-embedding-key") {
        return response(429, { error: { message: "Rate limited" } });
      }
      return response(200, {
        data: [{ index: 0, embedding: [1, 0] }],
      });
    },
  });

  assert.deepEqual(await client.embedBatch(["one", "two"]), [
    [1, 0],
    [1, 0],
  ]);
  assert.deepEqual(authorizationHeaders, [
    "Bearer primary-embedding-key",
    "Bearer backup-embedding-key",
    "Bearer backup-embedding-key",
  ]);
});

test("embedding client does not hide invalid vectors by switching keys", async () => {
  const authorizationHeaders = [];
  const client = new EmbeddingClient({
    apiKey: "primary-embedding-key",
    backupApiKey: "backup-embedding-key",
    model: "provider/embedding-model",
    expectedDimensions: 3,
    fetchImpl: async (_url, options) => {
      authorizationHeaders.push(options.headers.Authorization);
      return response(200, {
        data: [{ index: 0, embedding: [1, 0] }],
      });
    },
  });

  await assert.rejects(client.embed("query"), /exactly 3 dimensions/);
  assert.deepEqual(authorizationHeaders, ["Bearer primary-embedding-key"]);
});

test("embedding client does not fail over after caller cancellation", async () => {
  let requests = 0;
  const controller = new AbortController();
  controller.abort();
  const client = new EmbeddingClient({
    apiKey: "primary-embedding-key",
    backupApiKey: "backup-embedding-key",
    model: "provider/embedding-model",
    fetchImpl: async () => {
      requests += 1;
      throw new DOMException("Aborted", "AbortError");
    },
  });

  await assert.rejects(
    client.embed("query", { signal: controller.signal }),
    (error) =>
      error instanceof EmbeddingClientError &&
      error.code === "aborted" &&
      error.retryable === false,
  );
  assert.equal(requests, 1);
});
