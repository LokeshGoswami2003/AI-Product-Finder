const assert = require("node:assert/strict");
const path = require("node:path");

const { OfflineChatOrchestrator } = require("../src/chat/offline-orchestrator");
const { loadActiveRelease } = require("../src/corpus/load-release");

async function main() {
  const artifactDir = path.resolve(__dirname, "..", "..", "artifacts");
  const corpus = await loadActiveRelease(artifactDir);
  const orchestrator = new OfflineChatOrchestrator({
    products: corpus.products,
    answers: corpus.answers,
    questions: corpus.questions,
  });
  const cases = [
    {
      name: "exact approved question",
      message: "What is Eastman Acetaldehyde?",
      outcomes: ["exact"],
      product: "71000122",
    },
    {
      name: "application question",
      message: "How is Acetaldehyde used?",
      outcomes: ["exact", "lexical"],
      product: "71000122",
    },
    {
      name: "FGMN lookup",
      message: "Tell me about product 71000122",
      outcomes: ["entity"],
      product: "71000122",
    },
    {
      name: "bounded typo",
      message: "Tell me about Acetic Acid 56 Dilutted",
      outcomes: ["lexical"],
      product: "71001140",
    },
    {
      name: "context follow-up",
      message: "What about its technical properties?",
      context: { recentProductFgmns: ["71000122"] },
      outcomes: ["context"],
      product: "71000122",
    },
    {
      name: "greeting",
      message: "Hello",
      outcomes: ["social"],
    },
    {
      name: "safe no-match",
      message: "Find a quantum telemetry antenna for a spacecraft",
      outcomes: ["no-match"],
    },
  ];

  const results = [];
  for (const testCase of cases) {
    const answer = await orchestrator.answer({
      message: testCase.message,
      retrievalContext: testCase.context || {},
    });
    assert.ok(answer.text.trim(), `${testCase.name} returned empty text`);
    assert.ok(
      testCase.outcomes.includes(answer.retrieval.outcome),
      `${testCase.name} returned ${answer.retrieval.outcome}`,
    );
    const fgmns = answer.retrieval.results.map(({ product }) =>
      String(product.fgmn),
    );
    if (testCase.product) {
      assert.ok(
        fgmns.includes(testCase.product),
        `${testCase.name} missed product`,
      );
    }
    results.push({
      check: testCase.name,
      query: testCase.message,
      outcome: answer.retrieval.outcome,
      products: fgmns,
      answerChars: answer.text.length,
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "ok",
        releaseId: corpus.manifest.releaseId,
        checks: results,
      },
      null,
      2,
    )}\n`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Response checks failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
