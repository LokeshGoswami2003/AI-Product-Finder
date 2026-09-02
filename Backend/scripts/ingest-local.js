const path = require("node:path");

const { buildCatalogRelease } = require("../src/corpus/artifacts");
const { EmbeddingClient } = require("../src/embeddings/client");

function embeddingsEnabled(value) {
  return /^(?:1|true)$/i.test(value || "");
}

async function main() {
  const repositoryRoot = path.resolve(__dirname, "..", "..");
  const sourcePath = path.resolve(
    process.argv[2] || path.join(repositoryRoot, "productfinder.json"),
  );
  const artifactDir = path.resolve(
    process.argv[3] || path.join(repositoryRoot, "artifacts"),
  );
  const embeddingClient = embeddingsEnabled(process.env.EMBEDDING_ENABLED)
    ? new EmbeddingClient({
        apiKey: process.env.EMBEDDING_API_KEY,
        backupApiKey: process.env.EMBEDDING_BACKUP_API_KEY,
        model: process.env.EMBEDDING_MODEL,
        baseUrl:
          process.env.EMBEDDING_BASE_URL ||
          process.env.VERCEL_AI_GATEWAY_BASE_URL,
        batchSize: Number(process.env.EMBEDDING_BATCH_SIZE || 64),
        timeoutMs: Number(process.env.EMBEDDING_TIMEOUT_MS || 30000),
        expectedDimensions: process.env.EMBEDDING_DIMENSIONS
          ? Number(process.env.EMBEDDING_DIMENSIONS)
          : undefined,
      })
    : null;

  const { manifest, report } = await buildCatalogRelease({
    sourcePath,
    artifactDir,
    expectedProductCount: 979,
    embeddingClient,
  });

  process.stdout.write(
    `Created partial release ${manifest.releaseId}: ${report.productCount} products, ${report.chunkCount} chunks, embeddings ${report.embeddingStatus}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Ingestion failed: ${error.message}\n`);
  process.exitCode = 1;
});
