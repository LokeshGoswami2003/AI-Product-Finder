export const initialChatState = {
  messages: [],
  activeRequestId: null,
  progress: null,
  progressTrail: [],
  error: null,
  quota: {
    maxProductTurns: 12,
    usedProductTurns: 0,
    remainingProductTurns: 12,
    limitReached: false,
  },
};

export function chatReducer(state, action) {
  switch (action.type) {
    case "connection.ready":
      return { ...state, quota: action.quota || state.quota };
    case "conversation.snapshot":
      return {
        ...state,
        messages: action.messages,
        activeRequestId: null,
        progress: null,
        progressTrail: [],
        error: null,
        quota: action.quota || state.quota,
      };
    case "request.started":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: action.requestId, role: "user", content: action.message },
        ],
        activeRequestId: action.requestId,
        progress: "Understanding your question…",
        progressTrail: ["Understanding your question…"],
        error: null,
      };
    case "request.accepted":
      return withProgress(state, "Searching product knowledge…");
    case "request.progress":
      return withProgress(state, progressLabel(action.stage));
    case "answer.delta": {
      const answerId = `answer:${action.requestId}`;
      const existing = state.messages.find(
        (message) => message.id === answerId,
      );
      const messages = existing
        ? state.messages.map((message) =>
            message.id === answerId
              ? { ...message, content: message.content + action.delta }
              : message,
          )
        : [
            ...state.messages,
            {
              id: answerId,
              role: "assistant",
              content: action.delta,
              sources: [],
              products: [],
            },
          ];
      return { ...state, messages, progress: null, progressTrail: [] };
    }
    case "answer.sources":
      return updateAnswer(state, action.requestId, { sources: action.sources });
    case "answer.products":
      return updateAnswer(state, action.requestId, {
        products: action.products,
      });
    case "answer.done":
      return {
        ...state,
        activeRequestId: null,
        progress: null,
        progressTrail: [],
        quota: action.quota || state.quota,
      };
    case "request.error":
      return {
        ...state,
        activeRequestId: null,
        progress: null,
        progressTrail: [],
        error: action.message,
      };
    case "request.cancelled":
      return {
        ...state,
        activeRequestId: null,
        progress: null,
        progressTrail: [],
      };
    case "chat.clear":
      return {
        ...initialChatState,
        quota: state.quota,
      };
    default:
      return state;
  }
}

function updateAnswer(state, requestId, values) {
  const answerId = `answer:${requestId}`;
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.id === answerId ? { ...message, ...values } : message,
    ),
  };
}

function withProgress(state, progress) {
  const trail = state.progressTrail.includes(progress)
    ? state.progressTrail
    : [...state.progressTrail, progress];
  return { ...state, progress, progressTrail: trail.slice(-5) };
}

function progressLabel(stage) {
  const labels = {
    retrieving: "Scanning the product catalog…",
    matching: "Checking the closest approved matches…",
    grounding: "Reviewing product details…",
    generating: "Preparing the response…",
    composing: "Organizing the best match…",
  };
  return labels[stage] || "Working on your request…";
}
