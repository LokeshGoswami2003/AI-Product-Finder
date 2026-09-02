const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ResilientGenerationClient,
} = require("../src/generation/resilient-client");

function providerError({ retryable = true } = {}) {
  return Object.assign(new Error("Provider failure"), { retryable });
}

function client({ completion, stream } = {}) {
  return {
    createChatCompletion:
      completion ||
      (async () => ({ choices: [{ message: { content: "ok" } }] })),
    createChatCompletionStream:
      stream || (async () => ({ choices: [{ message: { content: "ok" } }] })),
  };
}

test("generation fails over from the primary OpenRouter key to the backup key", async () => {
  let primaryCalls = 0;
  let backupCalls = 0;
  const resilient = new ResilientGenerationClient({
    clients: [
      client({
        completion: async () => {
          primaryCalls += 1;
          throw providerError();
        },
      }),
      client({
        completion: async () => {
          backupCalls += 1;
          return { choices: [{ message: { content: "backup" } }] };
        },
      }),
    ],
  });

  const result = await resilient.createChatCompletion({ messages: [] });

  assert.equal(result.choices[0].message.content, "backup");
  assert.equal(primaryCalls, 1);
  assert.equal(backupCalls, 1);
});

test("generation reaches Vercel after both OpenRouter keys fail", async () => {
  const attempts = [];
  const failingClient = (name) =>
    client({
      completion: async () => {
        attempts.push(name);
        throw providerError();
      },
    });
  const resilient = new ResilientGenerationClient({
    clients: [
      failingClient("openrouter-primary"),
      failingClient("openrouter-backup"),
      client({
        completion: async () => {
          attempts.push("vercel");
          return { choices: [{ message: { content: "vercel" } }] };
        },
      }),
    ],
  });

  const result = await resilient.createChatCompletion({ messages: [] });

  assert.equal(result.choices[0].message.content, "vercel");
  assert.deepEqual(attempts, [
    "openrouter-primary",
    "openrouter-backup",
    "vercel",
  ]);
});

test("generation does not fail over for a malformed request", async () => {
  let backupCalls = 0;
  const badRequest = providerError({ retryable: false });
  const resilient = new ResilientGenerationClient({
    clients: [
      client({ completion: async () => Promise.reject(badRequest) }),
      client({
        completion: async () => {
          backupCalls += 1;
          return {};
        },
      }),
    ],
  });

  await assert.rejects(
    resilient.createChatCompletion({ messages: [] }),
    (error) => error === badRequest,
  );
  assert.equal(backupCalls, 0);
});

test("generation does not fail over after caller cancellation", async () => {
  let backupCalls = 0;
  const controller = new AbortController();
  controller.abort();
  const cancelled = providerError();
  const resilient = new ResilientGenerationClient({
    clients: [
      client({ completion: async () => Promise.reject(cancelled) }),
      client({
        completion: async () => {
          backupCalls += 1;
          return {};
        },
      }),
    ],
  });

  await assert.rejects(
    resilient.createChatCompletion({
      messages: [],
      signal: controller.signal,
    }),
    (error) => error === cancelled,
  );
  assert.equal(backupCalls, 0);
});

test("streaming fails over when an attempt fails before its first delta", async () => {
  const deltas = [];
  let backupCalls = 0;
  const resilient = new ResilientGenerationClient({
    clients: [
      client({
        stream: async () => {
          throw providerError();
        },
      }),
      client({
        stream: async ({ onDelta }) => {
          backupCalls += 1;
          onDelta("backup answer");
          return {
            choices: [{ message: { content: "backup answer" } }],
          };
        },
      }),
    ],
  });

  const result = await resilient.createChatCompletionStream({
    messages: [],
    onDelta: (delta) => deltas.push(delta),
  });

  assert.equal(result.choices[0].message.content, "backup answer");
  assert.equal(backupCalls, 1);
  assert.deepEqual(deltas, ["backup answer"]);
});

test("streaming never switches providers after its first delta", async () => {
  const deltas = [];
  let backupCalls = 0;
  const interrupted = providerError();
  const resilient = new ResilientGenerationClient({
    clients: [
      client({
        stream: async ({ onDelta }) => {
          onDelta("partial");
          throw interrupted;
        },
      }),
      client({
        stream: async () => {
          backupCalls += 1;
          return {};
        },
      }),
    ],
  });

  await assert.rejects(
    resilient.createChatCompletionStream({
      messages: [],
      onDelta: (delta) => deltas.push(delta),
    }),
    (error) => error === interrupted,
  );
  assert.equal(backupCalls, 0);
  assert.deepEqual(deltas, ["partial"]);
});
