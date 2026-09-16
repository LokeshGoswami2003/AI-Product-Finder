const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const path = require("node:path");

const { WebSocket } = require("ws");

const { OfflineChatOrchestrator } = require("../src/chat/offline-orchestrator");
const { parseEnv } = require("../src/config/env");
const { loadActiveRelease } = require("../src/corpus/load-release");
const { createServer } = require("../src/server");

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function websocketRequest({ port, origin, message }) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, { origin });
  const eventTypes = [];
  let productCount = 0;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Offline WebSocket smoke test timed out")),
        10000,
      );
      socket.on("error", reject);
      socket.on("message", (data) => {
        const event = JSON.parse(data.toString());
        eventTypes.push(event.type);
        if (event.type === "connection.ready") {
          socket.send(
            JSON.stringify({
              type: "chat.request",
              requestId: randomUUID(),
              message,
              region: null,
            }),
          );
        }
        if (event.type === "answer.products") {
          productCount = event.products.length;
        }
        if (event.type === "error") {
          clearTimeout(timeout);
          reject(new Error(`Offline WebSocket error: ${event.code}`));
        }
        if (event.type === "answer.done") {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  } finally {
    socket.close();
    await new Promise((resolve) => socket.once("close", resolve));
  }
  for (const expected of [
    "connection.ready",
    "chat.accepted",
    "chat.progress",
    "answer.delta",
    "answer.sources",
    "answer.products",
    "answer.done",
  ]) {
    assert.ok(eventTypes.includes(expected), `Missing ${expected} event`);
  }
  assert.ok(productCount > 0, "Offline WebSocket answer returned no product");
}

async function main() {
  const artifactDir = path.resolve(__dirname, "..", "..", "artifacts");
  const origin = "http://localhost:5173";
  const config = parseEnv({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    APP_ORIGIN: origin,
    CHAT_MODE: "offline",
    CORPUS_ARTIFACT_DIR: artifactDir,
  });
  assert.equal(config.CHAT_MAX_PRODUCT_TURNS, 12);
  const corpus = await loadActiveRelease(artifactDir);
  assert.ok(corpus.products.length > 0, "Active release has no products");
  assert.ok(
    corpus.answers.length > 0,
    "Active release has no approved answers",
  );
  assert.ok(
    corpus.questions.length > 0,
    "Active release has no approved questions",
  );

  const orchestrator = new OfflineChatOrchestrator({
    products: corpus.products,
    answers: corpus.answers,
    questions: corpus.questions,
  });
  const exact = await orchestrator.answer({
    message: corpus.questions[0].text,
  });
  assert.equal(exact.retrieval.outcome, "exact");
  assert.ok(exact.text.length > 0, "Exact match returned an empty answer");
  assert.ok(
    exact.retrieval.results.length > 0,
    "Exact match returned no product",
  );

  const noMatch = await orchestrator.answer({
    message: "zzzxxyyqqq offline smoke query",
  });
  assert.equal(noMatch.retrieval.outcome, "no-match");
  assert.equal(noMatch.kind, "out-of-scope");

  const { server, readiness } = await createServer({ config });
  let port;
  try {
    port = await listen(server);
    const response = await fetch(`http://127.0.0.1:${port}/api/health/ready`);
    const health = await response.json();
    assert.equal(response.status, 200);
    assert.equal(health.ready, true);
    assert.equal(health.corpusVersion, corpus.manifest.releaseId);
    await websocketRequest({
      port,
      origin,
      message: corpus.questions[0].text,
    });
    assert.equal(readiness().ready, true);
  } finally {
    await closeServer(server);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "ok",
        mode: "offline",
        releaseId: corpus.manifest.releaseId,
        products: corpus.products.length,
        answers: corpus.answers.length,
        questions: corpus.questions.length,
        checks: ["exact", "no-match", "health", "websocket"],
      },
      null,
      2,
    )}\n`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Offline smoke test failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, websocketRequest };
