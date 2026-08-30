const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const { WebSocket } = require('ws')

const { createSessionToken } = require('../src/auth/session')
const { attachChatWebSocket, validateEventLimits } = require('../src/websocket/chat-server')

const config = {
  APP_ORIGIN: 'http://localhost:5173',
  COOKIE_SIGNING_SECRET: '01234567890123456789012345678901',
  AUTH_COOKIE_NAME: 'product_finder_session',
  AUTH_TTL_SECONDS: 3600,
  CHAT_MAX_MESSAGE_CHARS: 4000,
  CHAT_MAX_HISTORY_TURNS: 10,
  CHAT_MAX_HISTORY_CHARS: 20000,
  WS_MAX_PAYLOAD_BYTES: 32768,
  WS_HEARTBEAT_MS: 30000,
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server.address().port
}

async function close(server, webSocketServer) {
  for (const client of webSocketServer.clients) client.terminate()
  await new Promise((resolve) => webSocketServer.close(resolve))
  await new Promise((resolve) => server.close(resolve))
}

test('authenticated WebSocket emits the complete protocol lifecycle', async (context) => {
  const server = http.createServer()
  const webSocketServer = attachChatWebSocket({
    server,
    config,
    corpusVersion: 'release-1',
    orchestrator: {
      answer: async ({ onProgress }) => {
        onProgress('grounding')
        onProgress('generating')
        return {
          text: 'Grounded answer',
          usage: { total_tokens: 10 },
          retrieval: {
            results: [
              {
                product: {
                  fgmn: '71103853',
                  displayName: 'AdapT 100',
                  documents: {},
                  links: {},
                },
                sources: [{ id: 'product:71103853', title: 'AdapT 100' }],
              },
            ],
          },
        }
      },
    },
  })
  context.after(() => close(server, webSocketServer))
  const port = await listen(server)
  const token = createSessionToken({
    secret: config.COOKIE_SIGNING_SECRET,
    ttlSeconds: config.AUTH_TTL_SECONDS,
  })
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, {
    origin: config.APP_ORIGIN,
    headers: { Cookie: `${config.AUTH_COOKIE_NAME}=${token}` },
  })
  const events = []

  await new Promise((resolve, reject) => {
    socket.on('error', reject)
    socket.on('message', (data) => {
      const event = JSON.parse(data.toString())
      events.push(event)
      if (event.type === 'connection.ready') {
        socket.send(
          JSON.stringify({
            type: 'chat.request',
            requestId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
            message: 'AdapT 100',
            history: [],
            region: null,
          }),
        )
      }
      if (event.type === 'answer.done') resolve()
    })
  })

  assert.deepEqual(
    events.map((event) => event.type),
    [
      'connection.ready',
      'chat.accepted',
      'chat.progress',
      'chat.progress',
      'chat.progress',
      'answer.delta',
      'answer.sources',
      'answer.products',
      'answer.done',
    ],
  )
  socket.close()
})

test('WebSocket rejects unauthenticated upgrades', async (context) => {
  const server = http.createServer()
  const webSocketServer = attachChatWebSocket({
    server,
    config,
    corpusVersion: 'release-1',
    orchestrator: { answer: async () => assert.fail('must not be called') },
  })
  context.after(() => close(server, webSocketServer))
  const port = await listen(server)
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, {
    origin: config.APP_ORIGIN,
  })

  const statusCode = await new Promise((resolve) => {
    socket.on('unexpected-response', (_request, response) => resolve(response.statusCode))
  })
  assert.equal(statusCode, 401)
})

test('WebSocket request limits bound current messages and history', () => {
  const baseEvent = {
    type: 'chat.request',
    message: 'request',
    history: [],
  }
  assert.equal(validateEventLimits(baseEvent, config), true)
  assert.equal(
    validateEventLimits(
      { ...baseEvent, message: 'x'.repeat(config.CHAT_MAX_MESSAGE_CHARS + 1) },
      config,
    ),
    false,
  )
  assert.equal(
    validateEventLimits(
      {
        ...baseEvent,
        history: [
          { role: 'user', content: 'x'.repeat(config.CHAT_MAX_HISTORY_CHARS + 1) },
        ],
      },
      config,
    ),
    false,
  )
})
