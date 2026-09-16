import assert from "node:assert/strict";
import test from "node:test";

import { chatReducer, initialChatState } from "../src/state/chat.js";
import { safeEastmanUrl } from "../src/protocol/links.js";
import {
  ANSWER_CHUNK_DELAY_MS,
  ANSWER_INITIAL_DELAY_MS,
  answerChunkDelay,
  chunkAnswerText,
} from "../src/hooks/useAnswerAnimator.js";

test("chat reducer accumulates answer deltas and structured results", () => {
  let state = chatReducer(initialChatState, {
    type: "request.started",
    requestId: "request-1",
    message: "Find a product",
  });
  state = chatReducer(state, {
    type: "answer.delta",
    requestId: "request-1",
    delta: "First ",
  });
  state = chatReducer(state, {
    type: "answer.delta",
    requestId: "request-1",
    delta: "answer.",
  });
  state = chatReducer(state, {
    type: "answer.products",
    requestId: "request-1",
    products: [{ fgmn: "71103853" }],
  });

  assert.equal(state.messages[1].content, "First answer.");
  assert.equal(state.messages[1].products[0].fgmn, "71103853");
});

test("clearing chat removes conversation and active request state", () => {
  const active = chatReducer(initialChatState, {
    type: "request.started",
    requestId: "request-1",
    message: "Find a product",
  });
  assert.deepEqual(
    chatReducer(active, { type: "chat.clear" }),
    initialChatState,
  );
});

test("matching progress is presented without implementation details", () => {
  const state = chatReducer(initialChatState, {
    type: "request.progress",
    stage: "matching",
  });

  assert.equal(state.progress, "Checking the closest approved matches…");
  assert.deepEqual(state.progressTrail, [
    "Checking the closest approved matches…",
  ]);
});

test("progress trail keeps completed user-facing status steps", () => {
  let state = chatReducer(initialChatState, {
    type: "request.started",
    requestId: "request-1",
    message: "Find a product",
  });
  state = chatReducer(state, { type: "request.accepted" });
  state = chatReducer(state, {
    type: "request.progress",
    stage: "matching",
  });

  assert.deepEqual(state.progressTrail, [
    "Understanding your question…",
    "Searching product knowledge…",
    "Checking the closest approved matches…",
  ]);
});

test("answer animation chunks preserve the complete response", () => {
  const answer = "A product answer with enough words to animate smoothly.";
  const chunks = chunkAnswerText(answer);

  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(""), answer);
});

test("answer animation uses a readable cadence with natural pauses", () => {
  assert.ok(ANSWER_INITIAL_DELAY_MS >= 800);
  assert.ok(ANSWER_CHUNK_DELAY_MS >= 60);
  assert.ok(answerChunkDelay("sentence. ") > answerChunkDelay("sentence "));
  assert.ok(answerChunkDelay("phrase, ") > answerChunkDelay("phrase "));
});

test("server snapshots restore conversation context and answer completion updates quota", () => {
  const quota = {
    maxProductTurns: 3,
    usedProductTurns: 2,
    remainingProductTurns: 1,
    limitReached: false,
  };
  let state = chatReducer(initialChatState, {
    type: "conversation.snapshot",
    messages: [
      { id: "request-1", role: "user", content: "Tell me about AdapT 100" },
      { id: "answer:request-1", role: "assistant", content: "Grounded answer" },
    ],
    quota,
  });

  assert.equal(state.messages[1].content, "Grounded answer");
  assert.equal(state.quota.remainingProductTurns, 1);

  state = chatReducer(state, {
    type: "answer.done",
    quota: {
      ...quota,
      usedProductTurns: 3,
      remainingProductTurns: 0,
      limitReached: true,
    },
  });
  assert.equal(state.quota.limitReached, true);
});

test("source links allow only approved Eastman HTTPS hosts", () => {
  assert.ok(
    safeEastmanUrl("https://www.eastman.com/en/products/product-finder"),
  );
  assert.equal(safeEastmanUrl("http://www.eastman.com/product"), null);
  assert.equal(
    safeEastmanUrl("https://www.eastman.com.example.test/product"),
    null,
  );
});
