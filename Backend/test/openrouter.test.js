const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");

const {
  OpenRouterClient,
  OpenRouterError,
} = require("../src/openrouter/client");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test("OpenRouter client defaults to GLM 5.2 Free", async () => {
  let request;
  const client = new OpenRouterClient({
    apiKey: "openrouter-key",
    siteUrl: "https://samvad.space",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response(200, {
        id: "completion",
        choices: [{ message: { content: "A useful answer" } }],
      });
    },
  });

  const result = await client.createChatCompletion({
    messages: [{ role: "user", content: "Find a product" }],
  });
  const payload = JSON.parse(request.options.body);

  assert.equal(result.id, "completion");
  assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(payload.model, "z-ai/glm-5.2:free");
  assert.equal(request.options.headers.Authorization, "Bearer openrouter-key");
  assert.equal(request.options.headers["HTTP-Referer"], "https://samvad.space");
  assert.equal(request.options.headers["X-Title"], "AI Product Finder");
});

test("OpenRouter client marks credential and provider failures as retryable", async () => {
  for (const status of [401, 402, 403, 404, 408, 409, 429, 500]) {
    const client = new OpenRouterClient({
      apiKey: "openrouter-key",
      fetchImpl: async () =>
        response(status, { error: { message: `Failure ${status}` } }),
    });

    await assert.rejects(
      client.createChatCompletion({ messages: [] }),
      (error) =>
        error instanceof OpenRouterError &&
        error.status === status &&
        error.retryable === true,
    );
  }
});

test("OpenRouter client does not retry malformed requests", async () => {
  const client = new OpenRouterClient({
    apiKey: "openrouter-key",
    fetchImpl: async () => response(400, { error: { message: "Bad request" } }),
  });

  await assert.rejects(
    client.createChatCompletion({ messages: [] }),
    (error) =>
      error instanceof OpenRouterError &&
      error.status === 400 &&
      error.retryable === false,
  );
});

test("OpenRouter client retries malformed or empty successful responses", async () => {
  const clients = [
    new OpenRouterClient({
      apiKey: "openrouter-key",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Invalid JSON");
        },
      }),
    }),
    new OpenRouterClient({
      apiKey: "openrouter-key",
      fetchImpl: async () => response(200, { choices: [] }),
    }),
  ];

  for (const client of clients) {
    await assert.rejects(
      client.createChatCompletion({ messages: [] }),
      (error) => error instanceof OpenRouterError && error.retryable === true,
    );
  }
});

test("OpenRouter client streams text deltas and usage", async () => {
  const chunks = [
    'data: {"model":"z-ai/glm-5.2:free","choices":[{"delta":{"content":"A useful "}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"answer."}}]}\n\n',
    'data: {"choices":[],"usage":{"total_tokens":12}}\n\ndata: [DONE]\n\n',
  ];
  const client = new OpenRouterClient({
    apiKey: "openrouter-key",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      body: Readable.from(chunks.map((chunk) => Buffer.from(chunk))),
    }),
  });
  const deltas = [];

  const result = await client.createChatCompletionStream({
    messages: [{ role: "user", content: "Find a product" }],
    onDelta: (delta) => deltas.push(delta),
  });

  assert.deepEqual(deltas, ["A useful ", "answer."]);
  assert.equal(result.choices[0].message.content, "A useful answer.");
  assert.deepEqual(result.usage, { total_tokens: 12 });
  assert.equal(result.model, "z-ai/glm-5.2:free");
});

test("OpenRouter client retries malformed and empty streams", async () => {
  const streams = [["data: {not-json}\n\n"], ["data: [DONE]\n\n"]];

  for (const chunks of streams) {
    const client = new OpenRouterClient({
      apiKey: "openrouter-key",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        body: Readable.from(chunks.map((chunk) => Buffer.from(chunk))),
      }),
    });

    await assert.rejects(
      client.createChatCompletionStream({ messages: [] }),
      (error) => error instanceof OpenRouterError && error.retryable === true,
    );
  }
});
