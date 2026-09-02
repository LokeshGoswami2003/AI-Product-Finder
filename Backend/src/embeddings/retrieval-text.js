const EMBEDDING_PROFILE = "gemini-asymmetric-search-v1";

function formatDocumentForEmbedding(chunk) {
  const title =
    chunk.displayName?.trim() || chunk.sectionTitle?.trim() || "none";
  return `title: ${title} | text: ${chunk.text}`;
}

function formatQueryForEmbedding(query) {
  return `task: search result | query: ${query}`;
}

module.exports = {
  EMBEDDING_PROFILE,
  formatDocumentForEmbedding,
  formatQueryForEmbedding,
};
