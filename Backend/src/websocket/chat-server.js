const { WebSocketServer, WebSocket } = require('ws')

const { readSessionCookie } = require('../auth/cookies')
const { verifySessionToken } = require('../auth/session')
const { parseClientEvent } = require('../protocol/client-events')

function send(socket, event) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event))
  }
}

function rejectUpgrade(socket, status, message) {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n${message}`)
  socket.destroy()
}

function validateEventLimits(event, config) {
  if (event.type !== 'chat.request') return true
  return (
    event.message.length <= config.CHAT_MAX_MESSAGE_CHARS &&
    event.history.length <= config.CHAT_MAX_HISTORY_TURNS &&
    event.history.reduce((total, entry) => total + entry.content.length, 0) <=
      config.CHAT_MAX_HISTORY_CHARS
  )
}

function attachChatWebSocket({ server, config, orchestrator, corpusVersion }) {
  const webSocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: config.WS_MAX_PAYLOAD_BYTES,
  })

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url, 'http://localhost')
    if (requestUrl.pathname !== '/ws/chat') {
      return rejectUpgrade(socket, '404 Not Found', 'Not found')
    }
    if (request.headers.origin !== config.APP_ORIGIN) {
      return rejectUpgrade(socket, '403 Forbidden', 'Forbidden')
    }

    const token = readSessionCookie(config, request.headers.cookie)
    if (!verifySessionToken(token, { secret: config.COOKIE_SIGNING_SECRET })) {
      return rejectUpgrade(socket, '401 Unauthorized', 'Unauthorized')
    }

    return webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit('connection', webSocket)
    })
  })

  webSocketServer.on('connection', (socket) => {
    let activeRequest = null
    send(socket, {
      type: 'connection.ready',
      protocolVersion: 1,
      corpusVersion,
    })

    socket.on('message', async (data) => {
      let event
      try {
        event = parseClientEvent(data.toString())
      } catch {
        send(socket, {
          type: 'error',
          code: 'invalid_event',
          message: 'The request format is invalid.',
          fatal: false,
        })
        return
      }

      if (!validateEventLimits(event, config)) {
        send(socket, {
          type: 'error',
          requestId: event.requestId,
          code: 'request_too_large',
          message: 'The message or conversation history exceeds the allowed limit.',
          fatal: false,
        })
        return
      }

      if (event.type === 'chat.cancel') {
        if (activeRequest?.requestId === event.requestId) {
          activeRequest.controller.abort()
          activeRequest = null
        }
        return
      }

      if (activeRequest) {
        send(socket, {
          type: 'error',
          requestId: event.requestId,
          code: 'request_in_progress',
          message: 'Another request is already in progress.',
          fatal: false,
        })
        return
      }

      const controller = new AbortController()
      activeRequest = { requestId: event.requestId, controller }
      send(socket, { type: 'chat.accepted', requestId: event.requestId })
      send(socket, {
        type: 'chat.progress',
        requestId: event.requestId,
        stage: 'retrieving',
      })

      try {
        const answer = await orchestrator.answer({
          message: event.message,
          history: event.history,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return

        send(socket, {
          type: 'answer.delta',
          requestId: event.requestId,
          delta: answer.text,
        })
        send(socket, {
          type: 'answer.sources',
          requestId: event.requestId,
          sources: answer.retrieval.results.flatMap((result) => result.sources),
        })
        send(socket, {
          type: 'answer.products',
          requestId: event.requestId,
          products: answer.retrieval.results.map(({ product }) => ({
            fgmn: product.fgmn,
            displayName: product.displayName,
            documents: product.documents,
            links: product.links,
          })),
        })
        send(socket, {
          type: 'answer.done',
          requestId: event.requestId,
          stopReason: 'complete',
          usage: answer.usage,
        })
      } catch (error) {
        if (!controller.signal.aborted) {
          send(socket, {
            type: 'error',
            requestId: event.requestId,
            code: error.name === 'OpenRouterError' ? 'model_error' : 'chat_error',
            message: 'The answer could not be completed. Please retry.',
            fatal: false,
          })
        }
      } finally {
        if (activeRequest?.requestId === event.requestId) {
          activeRequest = null
        }
      }
    })

    socket.on('close', () => {
      activeRequest?.controller.abort()
      activeRequest = null
    })
  })

  const heartbeat = setInterval(() => {
    for (const socket of webSocketServer.clients) {
      if (socket.isAlive === false) {
        socket.terminate()
        continue
      }
      socket.isAlive = false
      socket.ping()
    }
  }, config.WS_HEARTBEAT_MS)
  heartbeat.unref()

  webSocketServer.on('connection', (socket) => {
    socket.isAlive = true
    socket.on('pong', () => {
      socket.isAlive = true
    })
  })
  webSocketServer.on('close', () => clearInterval(heartbeat))

  return webSocketServer
}

module.exports = { attachChatWebSocket, validateEventLimits }
