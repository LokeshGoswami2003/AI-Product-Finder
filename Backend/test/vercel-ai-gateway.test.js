const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");

const {
  VercelAIGatewayClient,
  VercelAIGatewayError,
} = require("../src/vercel-ai-gateway/client");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test("Vercel AI Gateway client defaults to Grok 4.6", async () => {
  let request;
  const client = new VercelAIGatewayClient({
    apiKey: "gateway-key",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response(200, { id: "completion" });
    },
  });

  const result = await client.createChatCompletion({
    messages: [{ role: "user", content: "Find a product" }],
  });
  const payload = JSON.parse(request.options.body);

  assert.equal(result.id, "completion");
  assert.equal(request.url, "https://ai-gateway.vercel.sh/v1/chat/completions");
  assert.equal(payload.model, "spacexai/grok-4.6");
  assert.equal(request.options.headers.Authorization, "Bearer gateway-key");
});

test("Vercel AI Gateway client marks rate limits as retryable", async () => {
  const client = new VercelAIGatewayClient({
    apiKey: "gateway-key",
    fetchImpl: async () =>
      response(429, { error: { message: "Rate limited" } }),
  });

  await assert.rejects(
    client.createChatCompletion({ messages: [] }),
    (error) =>
      error instanceof VercelAIGatewayError &&
      error.status === 429 &&
      error.retryable === true,
  );
});

test("Vercel AI Gateway client forwards structured tool options", async () => {
  let request;
  const client = new VercelAIGatewayClient({
    apiKey: "gateway-key",
    fetchImpl: async (_url, options) => {
      request = options;
      return response(200, { choices: [{ message: { content: "{}" } }] });
    },
  });
  const tools = [
    {
      type: "vercel:perplexity_search",
      config: { search_domain_filter: ["eastman.com"] },
    },
  ];

  await client.createChatCompletion({
    messages: [{ role: "user", content: "Research adhesives" }],
    responseFormat: { type: "json_object" },
    tools,
    toolChoice: "required",
    maxTokens: 500,
  });
  const payload = JSON.parse(request.body);

  assert.deepEqual(payload.response_format, { type: "json_object" });
  assert.deepEqual(payload.tools, tools);
  assert.equal(payload.tool_choice, "required");
  assert.equal(payload.max_tokens, 500);
});

test("Vercel AI Gateway client surfaces non-retryable request failures", async () => {
  const client = new VercelAIGatewayClient({
    apiKey: "gateway-key",
    fetchImpl: async () => response(400, { error: { message: "Bad request" } }),
  });

  await assert.rejects(
    client.createChatCompletion({ messages: [] }),
    (error) =>
      error instanceof VercelAIGatewayError &&
      error.status === 400 &&
      error.retryable === false,
  );
});

test("Vercel AI Gateway client streams text deltas and usage", async () => {
  let request;
  const chunks = [
    'data: {"choices":[{"delta":{"content":"A useful "}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"answer."}}]}\n\n',
    'data: {"choices":[],"usage":{"total_tokens":12}}\n\ndata: [DONE]\n\n',
  ];
  const client = new VercelAIGatewayClient({
    apiKey: "gateway-key",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        body: Readable.from(chunks.map((chunk) => Buffer.from(chunk))),
      };
    },
  });
  const deltas = [];

  const result = await client.createChatCompletionStream({
    messages: [{ role: "user", content: "Find a product" }],
    onDelta: (delta) => deltas.push(delta),
  });
  const payload = JSON.parse(request.options.body);

  assert.equal(payload.stream, true);
  assert.deepEqual(payload.stream_options, { include_usage: true });
  assert.deepEqual(deltas, ["A useful ", "answer."]);
  assert.equal(result.choices[0].message.content, "A useful answer.");
  assert.deepEqual(result.usage, { total_tokens: 12 });
});
