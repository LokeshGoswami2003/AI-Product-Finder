const assert = require('node:assert/strict')
const test = require('node:test')

const fixture = require('./fixtures/adapt-100.json')
const { parseEnv } = require('../src/config/env')
const { parseClientEvent } = require('../src/protocol/client-events')
const { buildProductUrls, validateEastmanUrl } = require('../src/urls/eastman')

const validEnv = {
  AI_PROVIDER: 'bedrock',
  APP_ORIGIN: 'http://localhost:5173',
  MVP_ACCESS_CODE: 'test-code',
  COOKIE_SIGNING_SECRET: '01234567890123456789012345678901',
  AWS_REGION: 'us-east-1',
  BEDROCK_CHAT_MODEL_ID: 'test-model',
  BEDROCK_EXPECTED_RETENTION_MODE: 'none',
  EASTMAN_PRODUCT_FINDER_URL: 'https://www.eastman.com/en/products/product-finder',
}

test('environment schema applies safe defaults', () => {
  const env = parseEnv(validEnv)

  assert.equal(env.PORT, 3000)
  assert.equal(env.BEDROCK_EMBEDDING_DIMENSIONS, 1024)
  assert.equal(env.BEDROCK_EXPECTED_RETENTION_MODE, 'none')
})

test('environment schema rejects incomplete guardrail configuration', () => {
  assert.throws(() => parseEnv({ ...validEnv, BEDROCK_GUARDRAIL_ID: 'guardrail' }))
})

test('environment schema accepts multiple OpenRouter keys and the free router', () => {
  const env = parseEnv({
    ...validEnv,
    AI_PROVIDER: 'openrouter',
    OPENROUTER_API_KEYS: `${'a'.repeat(20)},${'b'.repeat(20)}`,
  })

  assert.equal(env.OPENROUTER_API_KEYS.length, 2)
  assert.equal(env.OPENROUTER_MODEL, 'openrouter/free')
})

test('client protocol parses chat requests and rejects unknown fields', () => {
  const event = parseClientEvent({
    type: 'chat.request',
    requestId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
    message: 'Compare products',
  })

  assert.deepEqual(event.history, [])
  assert.equal(event.region, null)
  assert.throws(() => parseClientEvent({ ...event, unexpected: true }))
})

test('Eastman URL builders produce allowlisted HTTPS links', () => {
  const urls = buildProductUrls(fixture)

  for (const url of Object.values(urls)) {
    assert.equal(validateEastmanUrl(url), true)
  }
  assert.match(urls.detail, /71000122\/adapt-100$/)
  assert.equal(new URL(urls.sds).searchParams.get('Product'), fixture.fgmn)
})

test('Eastman URL validation rejects lookalike and non-HTTPS links', () => {
  assert.equal(validateEastmanUrl('https://www.eastman.com.example.test/product'), false)
  assert.equal(validateEastmanUrl('http://www.eastman.com/product'), false)
})
