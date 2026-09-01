const MiniSearch = require("minisearch");

const QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "another",
  "are",
  "be",
  "been",
  "being",
  "can",
  "compare",
  "could",
  "do",
  "does",
  "eastman",
  "find",
  "for",
  "give",
  "good",
  "hello",
  "hey",
  "hi",
  "how",
  "i",
  "in",
  "is",
  "it",
  "like",
  "looking",
  "me",
  "my",
  "nature",
  "need",
  "of",
  "or",
  "our",
  "other",
  "please",
  "product",
  "products",
  "recommend",
  "show",
  "should",
  "some",
  "tell",
  "thank",
  "thanks",
  "the",
  "these",
  "to",
  "want",
  "was",
  "we",
  "what",
  "which",
  "with",
  "would",
  "you",
  "your",
]);

function prepareSearchQuery(query) {
  const normalizedQuery = query
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\bbpa\s*[- ]?\s*free\b/g, "bpa")
    .replace(/\bfree(?:\s+[a-z0-9]+){0,3}\s+bpa\b/g, "bpa");
  const terms = normalizedQuery
    .split(/[^a-z0-9]+/)
    .filter((term) => term && !QUERY_STOP_WORDS.has(term));

  return terms.length > 0 ? terms.join(" ") : query;
}

class LexicalIndex {
  constructor(products) {
    this.products = new Map(products.map((product) => [product.fgmn, product]));
    this.index = new MiniSearch({
      idField: "fgmn",
      fields: ["displayName", "sortName", "searchText", "description"],
      storeFields: ["fgmn"],
      searchOptions: {
        boost: { displayName: 8, sortName: 6, searchText: 2, description: 1 },
        combineWith: "OR",
        prefix: false,
        fuzzy: (term) => (term.length >= 5 ? 0.15 : false),
      },
    });
    this.index.addAll(products);
  }

  search(query, limit = 25) {
    return this.index
      .search(prepareSearchQuery(query))
      .slice(0, limit)
      .map((result, index) => ({
        fgmn: result.fgmn,
        product: this.products.get(result.fgmn),
        score: result.score,
        rank: index + 1,
      }));
  }
}

module.exports = { LexicalIndex, prepareSearchQuery };
