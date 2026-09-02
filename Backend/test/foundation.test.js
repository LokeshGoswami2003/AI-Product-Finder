const assert = require("node:assert/strict");
const test = require("node:test");

const fixture = require("./fixtures/adapt-100.json");
const { parseEnv } = require("../src/config/env");
const { parseClientEvent } = require("../src/protocol/client-events");
const { buildProductUrls, validateEastmanUrl } = require("../src/urls/eastman");

const validEnv = {
  AI_PROVIDER: "vercel",
  APP_ORIGIN: "http://localhost:5173",
  MVP_ACCESS_CODE: "test-code",
  COOKIE_SIGNING_SECRET: "01234567890123456789012345678901",
  VERCEL_AI_GATEWAY_API_KEY: "a".repeat(20),
  EASTMAN_PRODUCT_FINDER_URL:
    "https://www.eastman.com/en/products/product-finder",
};

test("environment schema applies safe defaults", () => {
  const env = parseEnv(validEnv);

  assert.equal(env.PORT, 3000);
  assert.equal(env.AI_PROVIDER, "vercel");
  assert.equal(env.VERCEL_AI_GATEWAY_MODEL, "zai/glm-5.3-flash");
  assert.equal(env.CHAT_MAX_PRODUCT_TURNS, 3);
  assert.equal(env.EMBEDDING_ENABLED, false);
  assert.equal(env.EMBEDDING_MODEL, "google/gemini-embedding-2");
  assert.equal(env.EMBEDDING_BASE_URL, "https://openrouter.ai/api/v1");
  assert.equal(env.EMBEDDING_DIMENSIONS, 768);
  assert.equal(env.EMBEDDING_BATCH_SIZE, 64);
});

test("environment schema accepts enabled Gemini hybrid embeddings", () => {
  const env = parseEnv({
    ...validEnv,
    EMBEDDING_ENABLED: "true",
    EMBEDDING_API_KEY: "b".repeat(20),
  });
  assert.equal(env.EMBEDDING_ENABLED, true);
  assert.equal(env.EMBEDDING_MODEL, "google/gemini-embedding-2");
  assert.equal(env.EMBEDDING_DIMENSIONS, 768);
});

test("environment schema requires a dedicated key when embeddings are enabled", () => {
  assert.throws(
    () => parseEnv({ ...validEnv, EMBEDDING_ENABLED: "true" }),
    /embedding API key is required/i,
  );
});

test("environment schema rejects a missing Vercel AI Gateway key", () => {
  const { VERCEL_AI_GATEWAY_API_KEY, ...withoutGatewayKey } = validEnv;

  assert.throws(() => parseEnv(withoutGatewayKey));
});

test("environment schema accepts Vercel AI Gateway with GLM 5.3 Flash", () => {
  const env = parseEnv({
    ...validEnv,
    AI_PROVIDER: "vercel",
    VERCEL_AI_GATEWAY_API_KEY: "a".repeat(20),
  });

  assert.equal(env.VERCEL_AI_GATEWAY_API_KEY, "a".repeat(20));
  assert.equal(env.VERCEL_AI_GATEWAY_MODEL, "zai/glm-5.3-flash");
});

test("client protocol parses chat requests and rejects unknown fields", () => {
  const event = parseClientEvent({
    type: "chat.request",
    requestId: "d9428888-122b-11e1-b85c-61cd3cbb3210",
    message: "Compare products",
  });

  assert.equal(event.region, null);
  assert.throws(() => parseClientEvent({ ...event, unexpected: true }));
  assert.throws(() => parseClientEvent({ ...event, history: [] }));
  assert.deepEqual(parseClientEvent({ type: "chat.clear" }), {
    type: "chat.clear",
  });
});

test("Eastman URL builders produce allowlisted HTTPS links", () => {
  const urls = buildProductUrls(fixture);

  for (const url of Object.values(urls)) {
    assert.equal(validateEastmanUrl(url), true);
  }
  assert.match(urls.detail, /71000122\/adapt-100$/);
  assert.equal(new URL(urls.sds).searchParams.get("Product"), fixture.fgmn);
});

test("Eastman URL validation rejects lookalike and non-HTTPS links", () => {
  assert.equal(
    validateEastmanUrl("https://www.eastman.com.example.test/product"),
    false,
  );
  assert.equal(validateEastmanUrl("http://www.eastman.com/product"), false);
});
