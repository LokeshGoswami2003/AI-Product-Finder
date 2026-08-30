const http = require('node:http')
const path = require('node:path')

const { createApp } = require('./app')
const { ChatOrchestrator } = require('./chat/orchestrator')
const { loadActiveRelease } = require('./corpus/load-release')
const { parseEnv } = require('./config/env')
const { EastmanDocumentClient } = require('./documents/eastman-document-client')
const { OpenRouterClient } = require('./openrouter/client')
const { ProductRetriever } = require('./retrieval/retriever')
const { attachChatWebSocket } = require('./websocket/chat-server')

async function createServer({ config = parseEnv(), modelClient } = {}) {
  let corpus
  let readinessError = null
  try {
    corpus = await loadActiveRelease(path.resolve(config.CORPUS_ARTIFACT_DIR))
  } catch (error) {
    readinessError = error
  }

  const readiness = () => ({
    ready: Boolean(corpus),
    status: corpus ? 'ready' : 'not_ready',
    corpusVersion: corpus?.manifest.releaseId || null,
    corpusStatus: corpus?.report.status || null,
    ...(readinessError ? { reason: 'corpus_unavailable' } : {}),
  })
  const app = createApp({ config, readiness })
  const server = http.createServer(app)

  if (corpus) {
    const retriever = new ProductRetriever(corpus)
    const client =
      modelClient ||
      new OpenRouterClient({
        apiKeys: config.OPENROUTER_API_KEYS,
        model: config.OPENROUTER_MODEL,
        baseUrl: config.OPENROUTER_BASE_URL,
        appName: config.OPENROUTER_APP_NAME,
        siteUrl: config.OPENROUTER_SITE_URL,
      })
    const documentClient = new EastmanDocumentClient({
      timeoutMs: config.DOCUMENT_FETCH_TIMEOUT_MS,
      cacheTtlMs: config.DOCUMENT_CACHE_TTL_SECONDS * 1000,
    })
    const orchestrator = new ChatOrchestrator({
      retriever,
      documentClient,
      modelClient: client,
    })
    attachChatWebSocket({
      server,
      config,
      orchestrator,
      corpusVersion: corpus.manifest.releaseId,
    })
  }

  return { app, server, readiness }
}

async function start() {
  const config = parseEnv()
  const { server } = await createServer({ config })
  server.listen(config.PORT, '127.0.0.1', () => {
    process.stdout.write(`AI Product Finder listening on 127.0.0.1:${config.PORT}\n`)
  })
}

module.exports = { createServer, start }
