const { createHash } = require("node:crypto");
const { mkdir, readFile, rename, rm, writeFile } = require("node:fs/promises");
const path = require("node:path");

const { catalogSchema } = require("./catalog-schema");
const {
  PARSER_VERSION,
  SCHEMA_VERSION,
  normalizeCatalog,
} = require("./normalize");
const { validateEastmanUrl } = require("../urls/eastman");
const {
  EMBEDDING_PROFILE,
  formatDocumentForEmbedding,
} = require("../embeddings/retrieval-text");

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validateNormalizedCatalog(normalized, expectedProductCount) {
  if (normalized.products.length !== expectedProductCount) {
    throw new Error(
      `Catalog contains ${normalized.products.length} products; expected ${expectedProductCount}`,
    );
  }

  const identifiers = new Set(
    normalized.products.map((product) => product.fgmn),
  );
  if (identifiers.size !== normalized.products.length) {
    throw new Error("Normalized products contain duplicate FGMNs");
  }

  for (const product of normalized.products) {
    for (const url of Object.values(product.links)) {
      if (!validateEastmanUrl(url)) {
        throw new Error(
          `Product ${product.fgmn} contains a non-allowlisted URL`,
        );
      }
    }
  }

  const chunkIds = new Set(normalized.chunks.map((chunk) => chunk.id));
  if (chunkIds.size !== normalized.chunks.length) {
    throw new Error("Normalized chunks contain duplicate IDs");
  }
}

async function buildCatalogRelease({
  sourcePath,
  artifactDir,
  now = new Date(),
  expectedProductCount,
  embeddingClient = null,
}) {
  const sourceBytes = await readFile(sourcePath);
  const sourceHash = createHash("sha256").update(sourceBytes).digest("hex");
  const catalog = catalogSchema.parse(JSON.parse(sourceBytes.toString("utf8")));
  const productCount =
    expectedProductCount ?? catalog.productDetails.labels.totalCount;
  const createdAt = now.toISOString();
  const normalized = normalizeCatalog(catalog, createdAt);

  validateNormalizedCatalog(normalized, productCount);

  let embeddings = null;
  let embeddingMetadata = null;
  if (embeddingClient) {
    const vectors = await embeddingClient.embedBatch(
      normalized.chunks.map(formatDocumentForEmbedding),
    );
    if (vectors.length !== normalized.chunks.length) {
      throw new Error("Embedding count does not match normalized chunk count");
    }
    const dimensions = vectors[0]?.length;
    if (!dimensions || vectors.some((vector) => vector.length !== dimensions)) {
      throw new Error("Generated embeddings have inconsistent dimensions");
    }
    embeddings = normalized.chunks.map((chunk, index) => ({
      chunkId: chunk.id,
      fgmn: chunk.fgmn,
      contentHash: chunk.contentHash,
      vector: vectors[index],
    }));
    embeddingMetadata = {
      model: embeddingClient.model,
      dimensions,
      generatedAt: createdAt,
      formatVersion: 1,
      profile: EMBEDDING_PROFILE,
    };
  }

  const releaseId = `${createdAt.replace(/[-:.]/g, "")}-${sourceHash.slice(0, 8)}`;
  const releasesDir = path.join(artifactDir, "releases");
  const releaseDir = path.join(releasesDir, releaseId);
  const temporaryDir = `${releaseDir}.tmp`;

  await mkdir(releasesDir, { recursive: true });
  await rm(temporaryDir, { recursive: true, force: true });
  await mkdir(temporaryDir);

  try {
    const memberships = {
      productToFacets: Object.fromEntries(
        normalized.products.map((product) => [product.fgmn, {}]),
      ),
      facetToProducts: {},
      complete: false,
    };
    const report = {
      status: "partial",
      productCount: normalized.products.length,
      facetCategoryCount: normalized.facets.length,
      chunkCount: normalized.chunks.length,
      embeddingStatus: embeddings ? "complete" : "none",
      embeddingCount: embeddings?.length || 0,
      warnings: [
        "Facet memberships require live single-facet queries and are not populated by local ingestion.",
        "Canonical product links are generated fallbacks until captured and validated from Eastman.",
      ],
    };
    const manifest = {
      releaseId,
      createdAt,
      schemaVersion: SCHEMA_VERSION,
      parserVersion: PARSER_VERSION,
      source: {
        path: path.basename(sourcePath),
        sha256: sourceHash,
      },
      files: {
        products: "products.json",
        facets: "facets.json",
        memberships: "memberships.json",
        chunks: "chunks.jsonl",
        ...(embeddings ? { embeddings: "embeddings.jsonl" } : {}),
        report: "report.json",
      },
      ...(embeddingMetadata ? { embeddings: embeddingMetadata } : {}),
    };

    const writes = [
      writeJson(path.join(temporaryDir, "manifest.json"), manifest),
      writeJson(path.join(temporaryDir, "products.json"), normalized.products),
      writeJson(path.join(temporaryDir, "facets.json"), normalized.facets),
      writeJson(path.join(temporaryDir, "memberships.json"), memberships),
      writeFile(
        path.join(temporaryDir, "chunks.jsonl"),
        `${normalized.chunks.map((chunk) => JSON.stringify(chunk)).join("\n")}\n`,
        "utf8",
      ),
      writeJson(path.join(temporaryDir, "report.json"), report),
    ];
    if (embeddings) {
      writes.push(
        writeFile(
          path.join(temporaryDir, "embeddings.jsonl"),
          `${embeddings.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
          "utf8",
        ),
      );
    }
    await Promise.all(writes);

    await rename(temporaryDir, releaseDir);

    const pointerPath = path.join(artifactDir, "current.json");
    const temporaryPointerPath = `${pointerPath}.tmp`;
    await writeJson(temporaryPointerPath, { releaseId });
    await rename(temporaryPointerPath, pointerPath);

    return { manifest, releaseDir, report };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { buildCatalogRelease, validateNormalizedCatalog };
