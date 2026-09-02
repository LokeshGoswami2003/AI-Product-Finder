const { readFile } = require("node:fs/promises");
const path = require("node:path");

const { VectorSearch } = require("../retrieval/vector-search");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonLines(filePath) {
  return (await readFile(filePath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function loadActiveRelease(artifactDir) {
  const pointer = await readJson(path.join(artifactDir, "current.json"));
  const releaseDir = path.join(artifactDir, "releases", pointer.releaseId);
  const [manifest, products, facets, memberships, report] = await Promise.all([
    readJson(path.join(releaseDir, "manifest.json")),
    readJson(path.join(releaseDir, "products.json")),
    readJson(path.join(releaseDir, "facets.json")),
    readJson(path.join(releaseDir, "memberships.json")),
    readJson(path.join(releaseDir, "report.json")),
  ]);

  if (manifest.releaseId !== pointer.releaseId) {
    throw new Error(
      "Active corpus pointer does not match its release manifest",
    );
  }

  let vectorSearch = null;
  if (manifest.files.embeddings) {
    const [chunks, embeddings] = await Promise.all([
      readJsonLines(path.join(releaseDir, manifest.files.chunks)),
      readJsonLines(path.join(releaseDir, manifest.files.embeddings)),
    ]);
    const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
    if (
      !manifest.embeddings?.dimensions ||
      embeddings.length !== chunks.length
    ) {
      throw new Error("Embedding artifact metadata or count is invalid");
    }
    const entries = embeddings.map((entry) => {
      const chunk = chunksById.get(entry.chunkId);
      if (
        !chunk ||
        chunk.fgmn !== entry.fgmn ||
        chunk.contentHash !== entry.contentHash
      ) {
        throw new Error(`Embedding ${entry.chunkId} does not match its chunk`);
      }
      return entry;
    });
    vectorSearch = new VectorSearch(entries, manifest.embeddings.dimensions);
  }

  return {
    releaseDir,
    manifest,
    products,
    facets,
    memberships,
    report,
    vectorSearch,
  };
}

module.exports = { loadActiveRelease, readJsonLines };
