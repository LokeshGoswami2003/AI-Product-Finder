const http = require("node:http");
const path = require("node:path");

const { createApp } = require("./app");
const { ConversationStore } = require("./chat/conversation-store");
const { OfflineChatOrchestrator } = require("./chat/offline-orchestrator");
const { loadActiveRelease } = require("./corpus/load-release");
const { parseEnv } = require("./config/env");
const { createLogger } = require("./config/logger");
const { attachChatWebSocket } = require("./websocket/chat-server");

async function createServer({
  config = parseEnv(),
  logger = createLogger({ name: "server", level: config.LOG_LEVEL }),
} = {}) {
  const conversationStore = new ConversationStore({
    maxProductTurns: config.CHAT_MAX_PRODUCT_TURNS,
    maxHistoryTurns: config.CHAT_MAX_HISTORY_TURNS,
    maxHistoryChars: config.CHAT_MAX_HISTORY_CHARS,
  });
  let corpus;
  let readinessError = null;
  try {
    corpus = await loadActiveRelease(path.resolve(config.CORPUS_ARTIFACT_DIR));
    logger.info("corpus.loaded", {
      releaseId: corpus.manifest.releaseId,
      productCount: corpus.products.length,
      corpusStatus: corpus.report.status,
    });
  } catch (error) {
    readinessError = error;
    logger.error("corpus.load_failed", {
      artifactDir: config.CORPUS_ARTIFACT_DIR,
      error,
    });
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
    logger,
  });
  const server = http.createServer(app);

  if (corpus) {
    const orchestrator = new OfflineChatOrchestrator({
      products: corpus.products,
      answers: corpus.answers,
      questions: corpus.questions,
      logger,
    });
    attachChatWebSocket({
      server,
      config,
      orchestrator,
      corpusVersion: corpus.manifest.releaseId,
      conversationStore,
      logger,
    });
  }

  return { app, server, readiness, conversationStore };
}

async function start() {
  const config = parseEnv();
  const logger = createLogger({ name: "server", level: config.LOG_LEVEL });
  logger.info("server.starting", {
    env: config.NODE_ENV,
    port: config.PORT,
    origin: config.APP_ORIGIN,
    chatMode: "offline",
  });
  const { server } = await createServer({ config, logger });
  server.listen(config.PORT, "127.0.0.1", () => {
    logger.info("server.listening", {
      host: "127.0.0.1",
      port: config.PORT,
    });
  });
}

module.exports = { createServer, start };
