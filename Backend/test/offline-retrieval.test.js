const assert = require("node:assert/strict");
const test = require("node:test");

const { OfflineChatOrchestrator } = require("../src/chat/offline-orchestrator");
const { OfflineRetriever } = require("../src/offline/retriever");

const products = [
  {
    fgmn: "71103853",
    displayName: "AdapT 100",
    description:
      "AdapT 100 is an MDEA-based solvent for selective H2S removal.",
    searchText: "adapt 100 mdea solvent selective h2s removal",
    documents: {
      hasTds: true,
      hasSds: true,
      hasSalesSpecification: true,
    },
    links: {
      detail: "https://www.eastman.com/adapt-100",
      tds: "https://productcatalog.eastman.com/adapt-100-tds",
      sds: "https://ws.eastman.com/adapt-100-sds",
    },
  },
  {
    fgmn: "71068692",
    displayName: "Eastman Tritan GX100",
    description: "A copolyester for heavy-gauge sheet applications.",
    searchText: "eastman tritan gx100 copolyester heavy gauge sheet",
    documents: { hasTds: true, hasSds: true },
    links: { detail: "https://www.eastman.com/tritan-gx100" },
  },
  {
    fgmn: "71000001",
    displayName: "Example Processing Aid",
    description: "Designed to match selected processing requirements.",
    searchText: "example processing aid match requirements",
    documents: { hasTds: false, hasSds: false },
    links: { detail: "https://www.eastman.com/example-processing-aid" },
  },
];

const answers = [
  {
    answerId: "product:71103853:overview:v1",
    intent: "product_overview",
    scope: "product",
    fgmns: ["71103853"],
    title: "AdapT 100 overview",
    answer: "Approved AdapT 100 answer.",
    evidenceIds: ["catalog:71103853"],
    sourceIds: ["product:71103853"],
    keywords: ["mdea", "h2s", "solvent"],
    negativeTerms: [],
    status: "approved",
  },
];

const questions = [
  {
    questionId: "question-1",
    answerId: answers[0].answerId,
    text: "Tell me about AdapT 100",
    normalizedText: "tell me about adapt 100",
    intent: "product_overview",
    entities: { fgmns: ["71103853"], products: ["adapt 100"] },
    variantType: "canonical",
    locale: "en",
    status: "approved",
  },
];

test("offline retrieval returns an approved exact answer with sources", () => {
  const retriever = new OfflineRetriever({ products, answers, questions });
  const match = retriever.retrieve("Tell me about AdapT 100");

  assert.equal(match.text, "Approved AdapT 100 answer.");
  assert.equal(match.outcome, "exact");
  assert.equal(match.results[0].product.fgmn, "71103853");
  assert.deepEqual(
    match.results[0].sources.map((source) => source.id),
    ["product:71103853"],
  );
});

test("offline retrieval uses deterministic product facts for an exact FGMN", () => {
  const retriever = new OfflineRetriever({ products });
  const match = retriever.retrieve("Show product 71068692");

  assert.equal(match.outcome, "entity");
  assert.match(match.text, /Eastman Tritan GX100/);
  assert.match(match.text, /heavy-gauge sheet/);
  assert.equal(match.results[0].product.fgmn, "71068692");
});

test("offline retrieval performs bounded lexical product discovery", () => {
  const retriever = new OfflineRetriever({ products });
  const match = retriever.retrieve("I need an MDEA solvent for H2S removal");

  assert.equal(match.results[0].product.fgmn, "71103853");
  assert.notEqual(match.outcome, "no-match");
});

test("offline retrieval reuses one recent product for a pronoun follow-up", () => {
  const retriever = new OfflineRetriever({ products });
  const match = retriever.retrieve("Does it have a TDS?", {
    recentProductFgmns: ["71103853"],
  });

  assert.equal(match.outcome, "context");
  assert.match(match.text, /technical data sheet/);
});

test("offline retrieval fails closed for an unrelated question", () => {
  const retriever = new OfflineRetriever({ products });
  const match = retriever.retrieve("Who won the football match yesterday?");

  assert.equal(match.outcome, "no-match");
  assert.deepEqual(match.results, []);
});

test("offline orchestrator preserves the websocket answer contract", async () => {
  const orchestrator = new OfflineChatOrchestrator({
    products,
    answers,
    questions,
  });
  const stages = [];
  const response = await orchestrator.answer({
    message: "Tell me about AdapT 100",
    onProgress: (stage) => stages.push(stage),
  });

  assert.equal(response.kind, "product");
  assert.equal(response.usage, null);
  assert.equal(response.retrieval.outcome, "exact");
  assert.deepEqual(stages, ["matching"]);
});
