const { createLogger, previewText } = require("../config/logger");
const { OfflineRetriever } = require("../offline/retriever");
const {
  classifyConversationalMessage,
  stripLeadingGreeting,
} = require("./conversational-intent");

class OfflineChatOrchestrator {
  constructor({
    products,
    answers = [],
    questions = [],
    logger = createLogger({ name: "chat" }),
  }) {
    this.retriever = new OfflineRetriever({ products, answers, questions });
    this.logger = logger.child("offline-orchestrator");
  }

  async answer({
    message,
    retrievalContext = {},
    intent,
    signal,
    onProgress = () => {},
  }) {
    if (signal?.aborted) {
      throw signal.reason || new Error("The request was aborted");
    }
    const conversationalIntent =
      intent || classifyConversationalMessage(message);
    if (conversationalIntent) {
      return {
        text: conversationalIntent.response,
        kind: conversationalIntent.type,
        retrieval: {
          outcome: conversationalIntent.type,
          region: null,
          results: [],
        },
        usage: null,
      };
    }

    const currentMessage = stripLeadingGreeting(message);
    onProgress("matching");
    const match = this.retriever.retrieve(currentMessage, retrievalContext);
    this.logger.info("chat.offline_answer_completed", {
      outcome: match.outcome,
      productCount: match.results.length,
      ...previewText(currentMessage),
    });
    return {
      text: match.text,
      kind: match.outcome === "no-match" ? "out-of-scope" : "product",
      retrieval: {
        outcome: match.outcome,
        region: null,
        results: match.results,
      },
      usage: null,
    };
  }
}

module.exports = { OfflineChatOrchestrator };
