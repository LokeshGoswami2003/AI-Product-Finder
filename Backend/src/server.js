const http = require("node:http");
const path = require("node:path");

const { createApp } = require("./app");
const {
  ConversationStore,
  deriveConversationId,
} = require("./chat/conversation-store");
const { ChatOrchestrator } = require("./chat/orchestrator");
const { loadActiveRelease } = require("./corpus/load-release");
const { parseEnv } = require("./config/env");
const {
  EastmanDocumentClient,
} = require("./documents/eastman-document-client");
const { ProductRetriever } = require("./retrieval/retriever");
const { VercelAIGatewayClient } = require("./vercel-ai-gateway/client");
const { attachChatWebSocket } = require("./websocket/chat-server");

async function createServer({ config = parseEnv(), modelClient } = {}) {
  const conversationStore = new ConversationStore({
    maxProductTurns: config.CHAT_MAX_PRODUCT_TURNS,
    maxHistoryTurns: config.CHAT_MAX_HISTORY_TURNS,
    maxHistoryChars: config.CHAT_MAX_HISTORY_CHARS,
  });
  let corpus;
  let readinessError = null;
  try {
    corpus = await loadActiveRelease(path.resolve(config.CORPUS_ARTIFACT_DIR));
  } catch (error) {
    readinessError = error;
  }

  const readiness = () => ({
    ready: Boolean(corpus),
    status: corpus ? "ready" : "not_ready",
    corpusVersion: corpus?.manifest.releaseId || null,
    corpusStatus: corpus?.report.status || null,
    ...(readinessError ? { reason: "corpus_unavailable" } : {}),
  });
  const app = createApp({
    config,
    readiness,
    onSessionLogout(session) {
      conversationStore.remove(
        deriveConversationId(session, config.COOKIE_SIGNING_SECRET),
      );
    },
  });
  const server = http.createServer(app);

  if (corpus) {
    const retriever = new ProductRetriever(corpus);
    const client =
      modelClient ||
      new VercelAIGatewayClient({
        apiKey: config.VERCEL_AI_GATEWAY_API_KEY,
        model: config.VERCEL_AI_GATEWAY_MODEL,
        baseUrl: config.VERCEL_AI_GATEWAY_BASE_URL,
      });
    const documentClient = new EastmanDocumentClient({
      timeoutMs: config.DOCUMENT_FETCH_TIMEOUT_MS,
      cacheTtlMs: config.DOCUMENT_CACHE_TTL_SECONDS * 1000,
    });
    const orchestrator = new ChatOrchestrator({
      retriever,
      documentClient,
      modelClient: client,
    });
    attachChatWebSocket({
      server,
      config,
      orchestrator,
      corpusVersion: corpus.manifest.releaseId,
      conversationStore,
    });
  }

  return { app, server, readiness, conversationStore };
}

async function start() {
  const config = parseEnv();
  const { server } = await createServer({ config });
  server.listen(config.PORT, "127.0.0.1", () => {
    process.stdout.write(
      `AI Product Finder listening on 127.0.0.1:${config.PORT}\n`,
    );
  });
}

module.exports = { createServer, start };
