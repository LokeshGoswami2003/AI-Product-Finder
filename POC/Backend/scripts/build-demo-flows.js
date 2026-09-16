const { createHash } = require("node:crypto");
const { mkdir, readFile, rename, writeFile } = require("node:fs/promises");
const path = require("node:path");

const { flows } = require("../corpus/demo-flows");
const { loadActiveRelease } = require("../src/corpus/load-release");
const { normalizeQuery } = require("../src/offline/normalization");

const ARTIFACT_DIR = path.resolve(__dirname, "..", "..", "artifacts");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function buildRecords(products) {
  const knownFgmns = new Set(products.map((product) => String(product.fgmn)));
  const answers = [];
  const questions = [];
  const normalizedSeen = new Map();

  for (const flow of flows) {
    for (const step of flow.steps) {
      const answerId = `demo:${flow.flowId}:${step.stepId}`;
      for (const fgmn of step.fgmns) {
        if (!knownFgmns.has(String(fgmn))) {
          throw new Error(`${answerId} references unknown FGMN ${fgmn}`);
        }
      }
      answers.push({
        answerId,
        intent: step.intent,
        scope: step.scope,
        fgmns: step.fgmns,
        title: step.title,
        answer: step.answer,
        evidenceIds: step.fgmns.map((fgmn) => `catalog:${fgmn}`),
        sourceIds: [],
        keywords: step.keywords,
        negativeTerms: [],
        status: "approved",
        review: {
          reviewer: "poc-curated-sales-flows",
          notes: `Curated demo flow ${flow.flowId} step ${step.stepId}: ${flow.title}`,
        },
        demoFlow: {
          flowId: flow.flowId,
          flowTitle: flow.title,
          persona: flow.persona,
          stepId: step.stepId,
        },
      });

      step.questions.forEach((text, index) => {
        const normalized = normalizeQuery(text);
        if (!normalized) throw new Error(`Empty question under ${answerId}`);
        const clash = normalizedSeen.get(normalized);
        if (clash && clash !== answerId) {
          throw new Error(
            `Curated question "${text}" is claimed by both ${clash} and ${answerId}`,
          );
        }
        normalizedSeen.set(normalized, answerId);
        questions.push({
          questionId: `demo:q:${flow.flowId}:${step.stepId}:${index}`,
          answerId,
          text,
          normalizedText: normalized,
          intent: step.intent,
          entities: { fgmns: step.fgmns, products: [] },
          variantType: index === 0 ? "canonical" : "paraphrase",
          locale: "en",
          status: "approved",
        });
      });
    }
  }

  return { answers, questions, normalizedSeen };
}

function toJsonLines(records) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function qaMarkdown(releaseId, products, answers, questions) {
  const productsByFgmn = new Map(
    products.map((product) => [String(product.fgmn), product]),
  );
  const stepCount = flows.reduce((total, flow) => total + flow.steps.length, 0);
  const lines = [
    "# POC Question & Answer Trails",
    "",
    "Curated multi-turn sales conversations served by the offline corpus. Every",
    "answer below is stored verbatim in the active release and returned",
    "deterministically — there is no model call at runtime.",
    "",
    `- **Active release:** \`${releaseId}\``,
    `- **Flows:** ${flows.length}`,
    `- **Question-and-answer steps:** ${stepCount}`,
    `- **Recognised question phrasings:** ${questions.length}`,
    "",
    "## How to read this document",
    "",
    "Each step lists the phrasings that resolve to it, the products returned with",
    "the answer, and the exact answer text. Any listed phrasing works; the first",
    "is the one used in the demo script.",
    "",
    "> **Technical data policy.** These answers name the properties and standard",
    "> test methods a buyer should compare, and point to the linked technical data",
    "> sheet for the values. No measured value is quoted unless it appears in the",
    "> Eastman catalog record for that product. This is deliberate: a curated",
    "> corpus must never become a source of unverifiable numbers.",
    "",
    "## Flow index",
    "",
  ];

  flows.forEach((flow, index) => {
    lines.push(
      `${index + 1}. **${flow.title}** — ${flow.steps.length} steps — _${flow.persona}_`,
    );
  });
  lines.push("");

  for (const [flowIndex, flow] of flows.entries()) {
    lines.push("---", "", `## ${flowIndex + 1}. ${flow.title}`, "");
    lines.push(`**Persona:** ${flow.persona}`, "");
    lines.push(
      `**Conversation arc:** ${flow.steps
        .map((step) => step.questions[0])
        .join(" → ")}`,
      "",
    );

    for (const [stepIndex, step] of flow.steps.entries()) {
      const answerId = `demo:${flow.flowId}:${step.stepId}`;
      lines.push(
        `### ${flowIndex + 1}.${stepIndex + 1} ${step.title}`,
        "",
        `\`${answerId}\` · intent \`${step.intent}\` · scope \`${step.scope}\``,
        "",
        "**Ask any of:**",
        "",
      );
      for (const question of step.questions) {
        lines.push(`- \`${question}\``);
      }
      lines.push("");

      if (step.fgmns.length > 0) {
        lines.push("**Products returned with the answer:**", "");
        for (const fgmn of step.fgmns) {
          const product = productsByFgmn.get(String(fgmn));
          const documents = [
            product.documents?.hasTds ? "TDS" : null,
            product.documents?.hasSds ? "SDS" : null,
            product.documents?.hasSalesSpecification
              ? "Sales specification"
              : null,
          ].filter(Boolean);
          lines.push(
            `- **${product.displayName}** — FGMN \`${fgmn}\` — documents: ${
              documents.join(", ") || "none published"
            }`,
          );
        }
        lines.push("");
      } else {
        lines.push(
          "**Products returned with the answer:** none — commercial guidance only",
          "",
        );
      }

      lines.push("**Answer:**", "");
      for (const line of step.answer.split("\n")) {
        lines.push(line ? `> ${line}` : ">");
      }
      lines.push("");
    }
  }

  lines.push(
    "---",
    "",
    "## Where the conversion happens",
    "",
    "Every trail is written to end in a commercial action rather than a dead end.",
    "",
    "- Each answer closes with a **Next step** question, rendered in the widget as",
    "  **Keep exploring**, so the buyer always has an obvious next move.",
    "- Each product card carries **View product**, **TDS**, **SDS**, **Sales",
    "  specification** (where published) and **Contact Eastman** links, so the",
    "  handoff to a representative is one click from any answer.",
    "- Flow 8 is the explicit conversion trail: how to request samples and pricing,",
    "  and how to reach a representative with the right information attached.",
    "",
    "## Rebuilding this corpus",
    "",
    "```powershell",
    "npm --prefix Backend run build:flows   # rebuild the release and this document",
    "npm --prefix Backend run check:flows   # assert every phrasing resolves correctly",
    "```",
    "",
  );

  return `${lines.join("\n")}\n`;
}

async function main() {
  const corpus = await loadActiveRelease(ARTIFACT_DIR);
  const { answers, questions, normalizedSeen } = buildRecords(corpus.products);

  const curatedAnswerIds = new Set(answers.map((answer) => answer.answerId));
  const retainedAnswers = corpus.answers.filter(
    (answer) => !curatedAnswerIds.has(answer.answerId),
  );
  // Curated answers lead the file so authored-answer lookups prefer them.
  const mergedAnswers = [...answers, ...retainedAnswers];

  const retainedQuestions = corpus.questions.filter((question) => {
    if (question.questionId.startsWith("demo:q:")) return false;
    const normalized = normalizeQuery(question.normalizedText || question.text);
    return !normalizedSeen.has(normalized);
  });
  const displacedQuestions = corpus.questions.length - retainedQuestions.length;
  const mergedQuestions = [...questions, ...retainedQuestions];

  const releaseId = `${new Date()
    .toISOString()
    .replace(/[-:.]/g, "")
    .replace("Z", "Z")}-demoflows`;
  const releaseDir = path.join(ARTIFACT_DIR, "releases", releaseId);
  await mkdir(releaseDir, { recursive: true });

  const productsJson = await readFile(
    path.join(corpus.releaseDir, "products.json"),
    "utf8",
  );
  const answersJsonl = toJsonLines(mergedAnswers);
  const questionsJsonl = toJsonLines(mergedQuestions);
  const report = {
    ...corpus.report,
    approvedAnswerCount: mergedAnswers.length,
    approvedQuestionCount: mergedQuestions.length,
    curatedDemoFlows: {
      flowCount: flows.length,
      stepCount: answers.length,
      questionVariantCount: questions.length,
      displacedGeneratedQuestions: displacedQuestions,
      flows: flows.map((flow) => ({
        flowId: flow.flowId,
        title: flow.title,
        persona: flow.persona,
        steps: flow.steps.length,
      })),
    },
  };
  const reportJson = `${JSON.stringify(report, null, 2)}\n`;

  const manifest = {
    ...corpus.manifest,
    releaseId,
    createdAt: new Date().toISOString(),
    offline: {
      ...corpus.manifest.offline,
      baseReleaseId: corpus.manifest.releaseId,
      curatedFlows: flows.length,
      fileSha256: {
        "products.json": sha256(productsJson),
        "answers.jsonl": sha256(answersJsonl),
        "questions.jsonl": sha256(questionsJsonl),
        "report.json": sha256(reportJson),
      },
    },
  };

  await writeFile(path.join(releaseDir, "products.json"), productsJson, "utf8");
  await writeFile(path.join(releaseDir, "answers.jsonl"), answersJsonl, "utf8");
  await writeFile(
    path.join(releaseDir, "questions.jsonl"),
    questionsJsonl,
    "utf8",
  );
  await writeFile(path.join(releaseDir, "report.json"), reportJson, "utf8");
  await writeFile(
    path.join(releaseDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  const pointerPath = path.join(ARTIFACT_DIR, "current.json");
  const pointerTemp = `${pointerPath}.tmp`;
  await writeFile(
    pointerTemp,
    `${JSON.stringify({ releaseId }, null, 2)}\n`,
    "utf8",
  );
  await rename(pointerTemp, pointerPath);

  // Re-read through the loader so a broken release never stays active silently.
  const verified = await loadActiveRelease(ARTIFACT_DIR);

  const qaPath = path.resolve(__dirname, "..", "..", "QA.md");
  await writeFile(
    qaPath,
    qaMarkdown(
      verified.manifest.releaseId,
      verified.products,
      answers,
      questions,
    ),
    "utf8",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "ok",
        releaseId: verified.manifest.releaseId,
        flowCount: flows.length,
        stepCount: answers.length,
        questionVariantCount: questions.length,
        displacedGeneratedQuestions: displacedQuestions,
        totalAnswers: verified.answers.length,
        totalQuestions: verified.questions.length,
      },
      null,
      2,
    )}\n`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Demo corpus build failed: ${error.message}\n`);
    if (error.cause) process.stderr.write(`Cause: ${error.cause}\n`);
    process.exitCode = 1;
  });
}

module.exports = { buildRecords, main };
