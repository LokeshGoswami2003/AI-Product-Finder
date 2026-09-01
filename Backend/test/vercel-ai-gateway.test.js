const assert = require('node:assert/strict')
const test = require('node:test')

const {
  VercelAIGatewayClient,
  VercelAIGatewayError,
} = require('../src/vercel-ai-gateway/client')

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

test('Vercel AI Gateway client defaults to GLM 5.3 Flash', async () => {
  let request
  const client = new VercelAIGatewayClient({
    apiKey: 'gateway-key',
    fetchImpl: async (url, options) => {
      request = { url, options }
      return response(200, { id: 'completion' })
    },
  })

  const result = await client.createChatCompletion({
    messages: [{ role: 'user', content: 'Find a product' }],
  })
  const payload = JSON.parse(request.options.body)

  assert.equal(result.id, 'completion')
  assert.equal(request.url, 'https://ai-gateway.vercel.sh/v1/chat/completions')
  assert.equal(payload.model, 'zai/glm-5.3-flash')
  assert.equal(request.options.headers.Authorization, 'Bearer gateway-key')
})

test('Vercel AI Gateway client marks rate limits as retryable', async () => {
  const client = new VercelAIGatewayClient({
    apiKey: 'gateway-key',
    fetchImpl: async () => response(429, { error: { message: 'Rate limited' } }),
  })

  await assert.rejects(
    client.createChatCompletion({ messages: [] }),
    (error) =>
      error instanceof VercelAIGatewayError &&
      error.status === 429 &&
      error.retryable === true,
  )
})

test('Vercel AI Gateway client surfaces non-retryable request failures', async () => {
  const client = new VercelAIGatewayClient({
    apiKey: 'gateway-key',
    fetchImpl: async () => response(400, { error: { message: 'Bad request' } }),
  })

  await assert.rejects(
    client.createChatCompletion({ messages: [] }),
    (error) =>
      error instanceof VercelAIGatewayError &&
      error.status === 400 &&
      error.retryable === false,
  )
})
