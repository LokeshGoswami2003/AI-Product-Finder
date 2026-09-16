const assert = require("node:assert/strict");
const path = require("node:path");

const { flows } = require("../corpus/demo-flows");
const { OfflineChatOrchestrator } = require("../src/chat/offline-orchestrator");
const { ConversationStore } = require("../src/chat/conversation-store");
const { loadActiveRelease } = require("../src/corpus/load-release");

const ARTIFACT_DIR = path.resolve(__dirname, "..", "..", "artifacts");

async function main() {
  const corpus = await loadActiveRelease(ARTIFACT_DIR);
  const orchestrator = new OfflineChatOrchestrator({
    products: corpus.products,
    answers: corpus.answers,
    questions: corpus.questions,
  });
  const store = new ConversationStore({ maxProductTurns: 50 });
  const answersById = new Map(
    corpus.answers.map((answer) => [answer.answerId, answer]),
  );

  const summary = [];
  for (const flow of flows) {
    const steps = [];
    for (const step of flow.steps) {
      const answerId = `demo:${flow.flowId}:${step.stepId}`;
      assert.ok(
        answersById.has(answerId),
        `Missing curated answer ${answerId}`,
      );
      const expected = answersById.get(answerId).answer;

      // Each paraphrase is checked in its own conversation so a match is never
      // an accident of the previous turn's context.
      for (const [index, question] of step.questions.entries()) {
        const conversation = store.getOrCreate(`${answerId}:${index}`);
        for (const prior of steps) {
          conversation.recentProductFgmns = prior.fgmns;
        }
        const result = await orchestrator.answer({
          message: question,
          retrievalContext: store.retrievalContext(conversation),
        });
        assert.equal(
          result.text,
          expected,
          `"${question}" did not return ${answerId} (got outcome ${result.retrieval.outcome})`,
        );
        assert.equal(
          result.retrieval.results.length,
          step.fgmns.length,
          `"${question}" returned ${result.retrieval.results.length} products, expected ${step.fgmns.length}`,
        );
        for (const { product, sources } of result.retrieval.results) {
          assert.ok(
            step.fgmns.includes(String(product.fgmn)),
            `"${question}" returned unexpected product ${product.fgmn}`,
          );
          assert.ok(
            sources.length > 0,
            `"${question}" returned no sources for ${product.fgmn}`,
          );
          for (const source of sources) {
            assert.ok(
              source.url?.startsWith("https://"),
              `Insecure or missing source URL for ${product.fgmn}`,
            );
          }
        }
      }

      assert.ok(
        step.answer.includes("### Next step"),
        `${answerId} does not end with a next step`,
      );
      steps.push({
        stepId: step.stepId,
        intent: step.intent,
        fgmns: step.fgmns,
        canonicalQuestion: step.questions[0],
        variants: step.questions.length,
      });
    }
    summary.push({
      flowId: flow.flowId,
      title: flow.title,
      persona: flow.persona,
      steps,
    });
  }

  const stepCount = summary.reduce(
    (total, flow) => total + flow.steps.length,
    0,
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "ok",
        releaseId: corpus.manifest.releaseId,
        flowCount: summary.length,
        stepCount,
        flows: summary,
      },
      null,
      2,
    )}\n`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Demo flow checks failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
