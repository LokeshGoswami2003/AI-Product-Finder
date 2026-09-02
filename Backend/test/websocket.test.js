const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const http = require("node:http");
const test = require("node:test");
const { WebSocket } = require("ws");

const { createSessionToken } = require("../src/auth/session");
const {
  attachChatWebSocket,
  validateEventLimits,
} = require("../src/websocket/chat-server");

const config = {
  APP_ORIGIN: "http://localhost:5173",
  COOKIE_SIGNING_SECRET: "01234567890123456789012345678901",
  AUTH_COOKIE_NAME: "product_finder_session",
  AUTH_TTL_SECONDS: 3600,
  CHAT_MAX_MESSAGE_CHARS: 4000,
  CHAT_MAX_PRODUCT_TURNS: 3,
  CHAT_MAX_HISTORY_TURNS: 10,
  CHAT_MAX_HISTORY_CHARS: 20000,
  WS_MAX_PAYLOAD_BYTES: 32768,
  WS_HEARTBEAT_MS: 30000,
};

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}

async function close(server, webSocketServer) {
  for (const client of webSocketServer.clients) client.terminate();
  await new Promise((resolve) => webSocketServer.close(resolve));
  await new Promise((resolve) => server.close(resolve));
}

test("authenticated WebSocket emits the complete protocol lifecycle", async (context) => {
  const server = http.createServer();
  const webSocketServer = attachChatWebSocket({
    server,
    config,
    corpusVersion: "release-1",
    orchestrator: {
      answer: async ({ onProgress, onDelta }) => {
        onProgress("grounding");
        onProgress("generating");
        onDelta("Grounded ");
        onDelta("answer");
        return {
          text: "Grounded answer",
          usage: { total_tokens: 10 },
          retrieval: {
            results: [
              {
                product: {
                  fgmn: "71103853",
                  displayName: "AdapT 100",
                  documents: {},
                  links: {},
                },
                sources: [{ id: "product:71103853", title: "AdapT 100" }],
              },
            ],
          },
        };
      },
    },
  });
  context.after(() => close(server, webSocketServer));
  const port = await listen(server);
  const token = createSessionToken({
    secret: config.COOKIE_SIGNING_SECRET,
    ttlSeconds: config.AUTH_TTL_SECONDS,
  });
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, {
    origin: config.APP_ORIGIN,
    headers: { Cookie: `${config.AUTH_COOKIE_NAME}=${token}` },
  });
  const events = [];

  await new Promise((resolve, reject) => {
    socket.on("error", reject);
    socket.on("message", (data) => {
      const event = JSON.parse(data.toString());
      events.push(event);
      if (event.type === "connection.ready") {
        socket.send(
          JSON.stringify({
            type: "chat.request",
            requestId: "d9428888-122b-11e1-b85c-61cd3cbb3210",
            message: "AdapT 100",
            region: null,
          }),
        );
      }
      if (event.type === "answer.done") resolve();
    });
  });

  assert.deepEqual(
    events.map((event) => event.type),
    [
      "connection.ready",
      "conversation.snapshot",
      "chat.accepted",
      "chat.progress",
      "chat.progress",
      "chat.progress",
      "answer.delta",
      "answer.delta",
      "answer.sources",
      "answer.products",
      "answer.done",
    ],
  );
  assert.equal(events[0].protocolVersion, 2);
  assert.deepEqual(
    events
      .filter((event) => event.type === "answer.delta")
      .map((event) => event.delta),
    ["Grounded ", "answer"],
  );
  socket.close();
});

test("WebSocket rejects unauthenticated upgrades", async (context) => {
  const server = http.createServer();
  const webSocketServer = attachChatWebSocket({
    server,
    config,
    corpusVersion: "release-1",
    orchestrator: { answer: async () => assert.fail("must not be called") },
  });
  context.after(() => close(server, webSocketServer));
  const port = await listen(server);
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, {
    origin: config.APP_ORIGIN,
  });

  const statusCode = await new Promise((resolve) => {
    socket.on("unexpected-response", (_request, response) =>
      resolve(response.statusCode),
    );
  });
  assert.equal(statusCode, 401);
});

test("WebSocket request limits bound current messages", () => {
  const baseEvent = {
    type: "chat.request",
    message: "request",
  };
  assert.equal(validateEventLimits(baseEvent, config), true);
  assert.equal(
    validateEventLimits(
      { ...baseEvent, message: "x".repeat(config.CHAT_MAX_MESSAGE_CHARS + 1) },
      config,
    ),
    false,
  );
});

test("server context survives reconnect and the fourth product request returns a handoff", async (context) => {
  const server = http.createServer();
  const calls = [];
  const product = {
    fgmn: "71103853",
    displayName: "AdapT 100",
    documents: { hasTds: true, hasSds: true },
    links: {
      detail:
        "https://www.eastman.com/en/products/product-detail/71103853/adapt-100",
    },
  };
  const webSocketServer = attachChatWebSocket({
    server,
    config,
    corpusVersion: "release-1",
    orchestrator: {
      answer: async (request) => {
        calls.push(request);
        if (request.intent) {
          return {
            text: request.intent.response,
            retrieval: { outcome: "social", results: [] },
            usage: null,
          };
        }
        return {
          text: `Grounded answer ${calls.length}`,
          usage: { total_tokens: 10 },
          retrieval: {
            results: [
              {
                product,
                sources: [
                  {
                    id: "product:71103853",
                    title: "AdapT 100",
                    url: product.links.detail,
                  },
                ],
              },
            ],
          },
        };
      },
    },
  });
  context.after(() => close(server, webSocketServer));
  const port = await listen(server);
  const token = createSessionToken({
    secret: config.COOKIE_SIGNING_SECRET,
    ttlSeconds: config.AUTH_TTL_SECONDS,
  });
  const socketOptions = {
    origin: config.APP_ORIGIN,
    headers: { Cookie: `${config.AUTH_COOKIE_NAME}=${token}` },
  };

  const firstSocket = new WebSocket(
    `ws://127.0.0.1:${port}/ws/chat`,
    socketOptions,
  );
  await new Promise((resolve, reject) => {
    let sent = false;
    firstSocket.on("error", reject);
    firstSocket.on("message", (data) => {
      const event = JSON.parse(data.toString());
      if (event.type === "conversation.snapshot" && !sent) {
        sent = true;
        firstSocket.send(
          JSON.stringify({
            type: "chat.request",
            requestId: randomUUID(),
            message: "Tell me about AdapT 100",
            region: null,
          }),
        );
      }
      if (event.type === "answer.done") resolve();
    });
  });
  firstSocket.close();
  await new Promise((resolve) => firstSocket.once("close", resolve));

  const secondSocket = new WebSocket(
    `ws://127.0.0.1:${port}/ws/chat`,
    socketOptions,
  );
  const messages = [
    "Hello there",
    "What about its technical properties?",
    "Tell me more about it",
    "Find another suitable product",
  ];
  const doneEvents = [];
  const sourceEvents = [];
  let restoredSnapshot;
  let nextMessage = 0;

  await new Promise((resolve, reject) => {
    secondSocket.on("error", reject);
    secondSocket.on("message", (data) => {
      const event = JSON.parse(data.toString());
      if (event.type === "conversation.snapshot" && !restoredSnapshot) {
        restoredSnapshot = event;
        const message = messages[nextMessage];
        nextMessage += 1;
        secondSocket.send(
          JSON.stringify({
            type: "chat.request",
            requestId: randomUUID(),
            message,
            region: null,
          }),
        );
      }
      if (event.type === "answer.sources") sourceEvents.push(event);
      if (event.type === "answer.done") {
        doneEvents.push(event);
        if (nextMessage < messages.length) {
          const message = messages[nextMessage];
          nextMessage += 1;
          secondSocket.send(
            JSON.stringify({
              type: "chat.request",
              requestId: randomUUID(),
              message,
              region: null,
            }),
          );
        } else {
          resolve();
        }
      }
    });
  });

  assert.equal(restoredSnapshot.quota.usedProductTurns, 1);
  assert.equal(restoredSnapshot.messages.length, 2);
  assert.equal(
    doneEvents[0].quota.usedProductTurns,
    1,
    "a greeting must not use quota",
  );
  assert.equal(doneEvents.at(-1).stopReason, "handoff");
  assert.equal(doneEvents.at(-1).quota.limitReached, true);
  assert.ok(
    sourceEvents.at(-1).sources[0].url.includes("/contact-us/product-inquiry"),
  );
  assert.equal(
    calls.length,
    4,
    "the fourth product request must bypass orchestration",
  );

  const contextualCall = calls.find(
    (call) => call.message === "What about its technical properties?",
  );
  assert.deepEqual(contextualCall.retrievalContext.recentProductFgmns, [
    "71103853",
  ]);
  assert.ok(
    contextualCall.history.some(
      (entry) => entry.content === "Grounded answer 1",
    ),
  );
  secondSocket.close();
});
