const path = require("node:path");

const { loadActiveRelease } = require("../src/corpus/load-release");
const { EmbeddingClient } = require("../src/embeddings/client");
const { ProductRetriever } = require("../src/retrieval/retriever");

const BENCHMARKS = [
  { query: "71103853", expectedFgmn: "71103853", expectedOutcome: "exact" },
  { query: "AdapT 100", expectedFgmn: "71103853", expectedOutcome: "exact" },
  { query: "MDEA solvent selective removal H2S", expectedFgmn: "71103853" },
  {
    query:
      "I want polymer for my plastic bottles which should be BPA free and transparent in nature",
    expectedFgmn: "71119050",
    excludedFgmns: ["71071434", "71001871", "71049144"],
  },
];

async function main() {
  const artifactDir = path.resolve(
    process.argv[2] || path.join(__dirname, "..", "..", "artifacts"),
  );
  const release = await loadActiveRelease(artifactDir);
  const embeddingsEnabled = /^(?:1|true)$/i.test(
    process.env.EMBEDDING_ENABLED || "",
  );
  const embeddingClient =
    embeddingsEnabled && release.vectorSearch
      ? new EmbeddingClient({
          apiKey:
            process.env.EMBEDDING_API_KEY ||
            process.env.VERCEL_AI_GATEWAY_API_KEY,
          model: process.env.EMBEDDING_MODEL,
          baseUrl:
            process.env.EMBEDDING_BASE_URL ||
            process.env.VERCEL_AI_GATEWAY_BASE_URL,
          batchSize: Number(process.env.EMBEDDING_BATCH_SIZE || 64),
          timeoutMs: Number(process.env.EMBEDDING_TIMEOUT_MS || 30000),
          expectedDimensions: release.manifest.embeddings.dimensions,
        })
      : null;
  const retriever = new ProductRetriever({ ...release, embeddingClient });
  const failures = [];

  for (const benchmark of BENCHMARKS) {
    const result = await retriever.retrieve(benchmark.query, { limit: 5 });
    const identifiers = result.results.map((entry) => entry.product.fgmn);
    if (
      !identifiers.includes(benchmark.expectedFgmn) ||
      benchmark.excludedFgmns?.some((fgmn) => identifiers.includes(fgmn)) ||
      (benchmark.expectedOutcome &&
        result.outcome !== benchmark.expectedOutcome)
    ) {
      failures.push({
        query: benchmark.query,
        expectedFgmn: benchmark.expectedFgmn,
        actualFgmn: identifiers,
        expectedOutcome: benchmark.expectedOutcome,
        actualOutcome: result.outcome,
      });
    }
  }

  if (failures.length > 0) {
    throw new Error(`Retrieval benchmark failed: ${JSON.stringify(failures)}`);
  }

  process.stdout.write(
    `Retrieval benchmark passed ${BENCHMARKS.length}/${BENCHMARKS.length} cases against ${release.manifest.releaseId}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
