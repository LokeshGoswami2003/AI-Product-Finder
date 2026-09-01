const assert = require("node:assert/strict");
const test = require("node:test");

const {
  classifyConversationalMessage,
  stripLeadingGreeting,
} = require("../src/chat/conversational-intent");
const {
  ConversationStore,
  deriveConversationId,
} = require("../src/chat/conversation-store");

const session = { nonce: "test-session-nonce" };
const secret = "01234567890123456789012345678901";

test("conversation identities are stable, anonymous, and session-specific", () => {
  const identifier = deriveConversationId(session, secret);
  assert.match(identifier, /^[a-f0-9]{64}$/);
  assert.equal(identifier, deriveConversationId(session, secret));
  assert.notEqual(
    identifier,
    deriveConversationId({ nonce: "another-session" }, secret),
  );
});

test("social intent handles greetings, gratitude, capability, goodbye, and scope boundaries", () => {
  for (const message of [
    "Hi",
    "Hello there, how are you?",
    "Good morning sir",
    "Namaste",
  ]) {
    assert.equal(classifyConversationalMessage(message).subtype, "greeting");
  }
  assert.equal(
    classifyConversationalMessage("Thank you very much").subtype,
    "gratitude",
  );
  assert.equal(
    classifyConversationalMessage("What can you do?").subtype,
    "capability",
  );
  assert.equal(
    classifyConversationalMessage("See you later").subtype,
    "goodbye",
  );
  assert.equal(
    classifyConversationalMessage("Tell me a joke").type,
    "out-of-scope",
  );
  assert.equal(
    classifyConversationalMessage("Who is the president?").type,
    "out-of-scope",
  );
  assert.equal(
    classifyConversationalMessage("Write JavaScript code").type,
    "out-of-scope",
  );
  assert.equal(
    classifyConversationalMessage("Latest football score").type,
    "out-of-scope",
  );
  assert.equal(
    classifyConversationalMessage("weather resistant coating resin"),
    null,
  );
  assert.equal(
    classifyConversationalMessage("Hi, find a resin for wood coatings"),
    null,
  );
  assert.equal(
    stripLeadingGreeting("Hi, find a resin for wood coatings"),
    "find a resin for wood coatings",
  );
});

test("conversation store bounds server history and enforces three product turns", () => {
  const store = new ConversationStore({
    maxProductTurns: 3,
    maxHistoryTurns: 10,
    maxHistoryChars: 20_000,
  });
  const conversation = store.getOrCreate("conversation-1", Date.now() + 60_000);

  assert.equal(
    store.beginRequest(conversation, "social-1", { countsAsProduct: false })
      .status,
    "started",
  );
  store.completeRequest(conversation, "social-1", {
    userMessage: "Hello",
    assistantMessage: { content: "Hello!", sources: [], products: [] },
  });
  assert.equal(store.quota(conversation).remainingProductTurns, 3);

  for (let turn = 1; turn <= 3; turn += 1) {
    const requestId = `product-${turn}`;
    assert.equal(
      store.beginRequest(conversation, requestId, { countsAsProduct: true })
        .status,
      "started",
    );
    store.completeRequest(conversation, requestId, {
      userMessage: `Question ${turn}`,
      assistantMessage: {
        content: `Answer ${turn}`,
        sources: [],
        products: [],
      },
      productFgmns: ["71103853"],
    });
  }

  assert.equal(store.quota(conversation).remainingProductTurns, 0);
  assert.equal(store.quota(conversation).limitReached, false);
  assert.equal(
    store.beginRequest(conversation, "product-4", { countsAsProduct: true })
      .status,
    "handoff",
  );
  assert.equal(store.quota(conversation).limitReached, true);
  assert.deepEqual(store.retrievalContext(conversation), {
    recentProductFgmns: ["71103853"],
    lastProductRequest: "Question 3",
  });
  assert.ok(
    store
      .modelHistory(conversation)
      .some((entry) => entry.content === "Answer 3"),
  );
});

test("failed requests restore quota and clearing context preserves the session quota", () => {
  const store = new ConversationStore({ maxProductTurns: 3 });
  const conversation = store.getOrCreate("conversation-1", Date.now() + 60_000);

  store.beginRequest(conversation, "request-1", { countsAsProduct: true });
  assert.equal(store.quota(conversation).usedProductTurns, 1);
  store.failRequest(conversation, "request-1");
  assert.equal(store.quota(conversation).usedProductTurns, 0);

  store.beginRequest(conversation, "request-2", { countsAsProduct: true });
  store.completeRequest(conversation, "request-2", {
    userMessage: "Find a coating resin",
    assistantMessage: { content: "Result", sources: [], products: [] },
  });
  store.clearTranscript(conversation);

  assert.deepEqual(store.snapshot(conversation).messages, []);
  assert.equal(store.quota(conversation).usedProductTurns, 1);
});

test("conversation store evicts context when the signed session expires", () => {
  let now = 1_000;
  const store = new ConversationStore({ now: () => now });
  const conversation = store.getOrCreate("conversation-1", 2_000);
  assert.equal(store.conversations.get("conversation-1"), conversation);

  now = 2_000;
  store.pruneExpired();
  assert.equal(store.conversations.has("conversation-1"), false);
});
