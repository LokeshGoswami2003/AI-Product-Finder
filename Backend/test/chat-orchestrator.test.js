const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildRetrievalPlan,
  ChatOrchestrator,
} = require("../src/chat/orchestrator");

const product = {
  fgmn: "71103853",
  displayName: "AdapT 100",
  description: "MDEA-based solvent for selective H2S removal.",
  documents: { hasTds: true, hasSds: true },
  links: {
    detail: "https://www.eastman.com/product",
    tds: "https://productcatalog.eastman.com/tds",
    sds: "https://ws.eastman.com/sds",
  },
};
const retrieval = {
  outcome: "exact",
  results: [
    {
      product,
      sources: [
        { id: "product:71103853", url: "https://www.eastman.com/product" },
      ],
    },
  ],
};

test("chat orchestration retrieves before generation and bounds model evidence", async () => {
  let request;
  const orchestrator = new ChatOrchestrator({
    retriever: { retrieve: async () => retrieval },
    documentClient: {
      enrichProduct: async (_product, plan) => [
        {
          type: "tds",
          status: "available",
          label: "Technical data sheet",
          text: "Density: 1.04 g/cm3",
          source: { id: "tds:71103853", url: product.links.tds },
          plan,
        },
      ],
    },
    modelClient: {
      createChatCompletion: async (value) => {
        request = value;
        return {
          choices: [
            {
              message: { content: "AdapT 100 matches the supplied evidence." },
            },
          ],
          usage: { total_tokens: 42 },
        };
      },
    },
  });

  const answer = await orchestrator.answer({
    message: "Tell me about AdapT 100",
    history: [],
    signal: AbortSignal.timeout(1_000),
  });

  assert.match(answer.text, /AdapT 100/);
  assert.match(request.messages.at(-1).content, /71103853/);
  assert.match(request.messages.at(-1).content, /Density: 1\.04 g\/cm3/);
  assert.match(
    request.messages[0].content,
    /only from the supplied catalog information/i,
  );
  assert.match(
    request.messages[0].content,
    /experienced Eastman product sales representative/i,
  );
  assert.deepEqual(answer.plan, {
    mode: "product-detail",
    maxProducts: 1,
    includeTds: true,
    includeSds: false,
  });
  assert.deepEqual(
    answer.retrieval.results[0].sources.map((source) => source.id),
    ["product:71103853", "tds:71103853"],
  );
  assert.deepEqual(answer.usage, { total_tokens: 42 });
});

test("chat orchestration uses retrieval evidence to reject unrelated topics", async () => {
  let modelCalled = false;
  const retrievalQueries = [];
  const orchestrator = new ChatOrchestrator({
    retriever: {
      retrieve: async (query) => {
        retrievalQueries.push(query);
        return { outcome: "no-evidence", results: [] };
      },
    },
    documentClient: {
      enrichProduct: async () => assert.fail("must not fetch documents"),
    },
    modelClient: {
      createChatCompletion: async () => {
        modelCalled = true;
      },
    },
  });

  for (const message of [
    "What is the capital of China?",
    "Write a sorting algorithm",
    "Give me a pasta recipe",
    "Who won yesterday's football match?",
    "Explain quantum gravity",
  ]) {
    const answer = await orchestrator.answer({ message, history: [] });
    assert.equal(answer.kind, "out-of-scope");
    assert.deepEqual(answer.retrieval.results, []);
    assert.match(
      answer.text,
      /doesn’t appear to match the Eastman product catalog/i,
    );
  }

  assert.equal(modelCalled, false);
  assert.deepEqual(retrievalQueries, [
    "What is the capital of China?",
    "Write a sorting algorithm",
    "Give me a pasta recipe",
    "Who won yesterday's football match?",
    "Explain quantum gravity",
  ]);
});

test("chat orchestration answers social messages without retrieval, documents, or model calls", async () => {
  const orchestrator = new ChatOrchestrator({
    retriever: {
      retrieve: async () => assert.fail("must not retrieve greetings"),
    },
    documentClient: {
      enrichProduct: async () =>
        assert.fail("must not fetch greeting documents"),
    },
    modelClient: {
      createChatCompletion: async () =>
        assert.fail("must not call the model for greetings"),
    },
  });

  const answer = await orchestrator.answer({
    message: "Hello there, how are you?",
  });

  assert.equal(answer.kind, "social");
  assert.match(answer.text, /Eastman product assistant/i);
  assert.deepEqual(answer.retrieval.results, []);
});

test("chat orchestration sends server context to retrieval and the model", async () => {
  let receivedContext;
  let modelMessages;
  const orchestrator = new ChatOrchestrator({
    retriever: {
      retrieve: async (_message, options) => {
        receivedContext = options.context;
        return retrieval;
      },
    },
    documentClient: { enrichProduct: async () => [] },
    modelClient: {
      createChatCompletion: async ({ messages }) => {
        modelMessages = messages;
        return { choices: [{ message: { content: "Context-aware answer" } }] };
      },
    },
  });
  const history = [
    { role: "user", content: "Tell me about AdapT 100" },
    { role: "assistant", content: "AdapT 100 is a shortlisted option." },
  ];
  const retrievalContext = {
    recentProductFgmns: ["71103853"],
    lastProductRequest: "Tell me about AdapT 100",
  };

  await orchestrator.answer({
    message: "What about its technical properties?",
    history,
    retrievalContext,
  });

  assert.deepEqual(receivedContext, retrievalContext);
  assert.deepEqual(modelMessages.slice(1, 3), history);
});

test("retrieval planning adds SDS only for safety intent and bounds comparisons", () => {
  assert.deepEqual(
    buildRetrievalPlan("Compare safe handling and PPE for these options", {
      outcome: "recommendation",
    }),
    {
      mode: "comparison",
      maxProducts: 3,
      includeTds: true,
      includeSds: true,
    },
  );
  assert.deepEqual(
    buildRetrievalPlan("Find a coating resin", { outcome: "recommendation" }),
    {
      mode: "recommendation",
      maxProducts: 3,
      includeTds: true,
      includeSds: false,
    },
  );
});

test("safety scenario passes catalog, TDS, and SDS evidence to the sales response", async () => {
  let requestedPlan;
  let modelRequest;
  const orchestrator = new ChatOrchestrator({
    retriever: { retrieve: async () => retrieval },
    documentClient: {
      enrichProduct: async (_product, plan) => {
        requestedPlan = plan;
        return [
          {
            type: "tds",
            status: "available",
            label: "Technical data sheet",
            text: "Flash point: 138 C",
            source: { id: "tds:71103853", url: product.links.tds },
          },
          {
            type: "sds",
            status: "available",
            label: "India (English)",
            text: "Use protective gloves.",
            source: { id: "sds:71103853", url: product.links.sds },
          },
        ];
      },
    },
    modelClient: {
      createChatCompletion: async (request) => {
        modelRequest = request;
        return {
          choices: [
            {
              message: {
                content:
                  "AdapT 100 fits selective H2S removal.\n\n### Safety\n- Use protective gloves.\n\n### Next step\nConfirm the operating region.",
              },
            },
          ],
        };
      },
    },
  });

  const answer = await orchestrator.answer({
    message: "What SDS handling information applies to AdapT 100 in India?",
    history: [],
  });

  assert.equal(requestedPlan.includeSds, true);
  assert.match(modelRequest.messages.at(-1).content, /India \(English\)/);
  assert.match(modelRequest.messages.at(-1).content, /Use protective gloves/);
  assert.match(answer.text, /### Next step/);
  assert.deepEqual(
    answer.retrieval.results[0].sources.map((source) => source.id),
    ["product:71103853", "tds:71103853", "sds:71103853"],
  );
});
