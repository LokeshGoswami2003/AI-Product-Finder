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
const { EmbeddingClient } = require("./embeddings/client");
const { EMBEDDING_PROFILE } = require("./embeddings/retrieval-text");
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
    let embeddingClient = null;
    if (config.EMBEDDING_ENABLED && corpus.vectorSearch) {
      const releaseEmbeddings = corpus.manifest.embeddings;
      if (releaseEmbeddings.profile !== EMBEDDING_PROFILE) {
        throw new Error(
          `Embedding profile mismatch: release uses ${releaseEmbeddings.profile || "none"}, runtime uses ${EMBEDDING_PROFILE}`,
        );
      }
      if (releaseEmbeddings.model !== config.EMBEDDING_MODEL) {
        throw new Error(
          `Embedding model mismatch: release uses ${releaseEmbeddings.model}, configuration uses ${config.EMBEDDING_MODEL}`,
        );
      }
      if (
        config.EMBEDDING_DIMENSIONS &&
        releaseEmbeddings.dimensions !== config.EMBEDDING_DIMENSIONS
      ) {
        throw new Error(
          `Embedding dimension mismatch: release uses ${releaseEmbeddings.dimensions}, configuration uses ${config.EMBEDDING_DIMENSIONS}`,
        );
      }
      embeddingClient = new EmbeddingClient({
        apiKey: config.EMBEDDING_API_KEY || config.VERCEL_AI_GATEWAY_API_KEY,
        model: config.EMBEDDING_MODEL,
        baseUrl: config.EMBEDDING_BASE_URL,
        batchSize: config.EMBEDDING_BATCH_SIZE,
        timeoutMs: config.EMBEDDING_TIMEOUT_MS,
        expectedDimensions: releaseEmbeddings.dimensions,
      });
    }
    const retriever = new ProductRetriever({ ...corpus, embeddingClient });
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
