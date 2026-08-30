const assert = require('node:assert/strict')
const test = require('node:test')

const { OpenRouterClient, OpenRouterError } = require('../src/openrouter/client')

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

test('OpenRouter client defaults to the free model router', async () => {
  let request
  const client = new OpenRouterClient({
    apiKeys: ['key-one'],
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
  assert.equal(payload.model, 'openrouter/free')
  assert.equal(request.options.headers.Authorization, 'Bearer key-one')
})

test('OpenRouter client rotates keys only for key-specific failures', async () => {
  const keys = []
  const client = new OpenRouterClient({
    apiKeys: ['key-one', 'key-two'],
    fetchImpl: async (_url, options) => {
      keys.push(options.headers.Authorization)
      return keys.length === 1
        ? response(429, { error: { message: 'Rate limited' } })
        : response(200, { id: 'completion' })
    },
  })

  await client.createChatCompletion({ messages: [] })
  assert.deepEqual(keys, ['Bearer key-one', 'Bearer key-two'])
})

test('OpenRouter client surfaces non-key request failures', async () => {
  const client = new OpenRouterClient({
    apiKeys: ['key-one', 'key-two'],
    fetchImpl: async () => response(400, { error: { message: 'Bad request' } }),
  })

  await assert.rejects(
    client.createChatCompletion({ messages: [] }),
    (error) => error instanceof OpenRouterError && error.status === 400,
  )
})

