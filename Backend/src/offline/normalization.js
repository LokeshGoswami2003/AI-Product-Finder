const STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "can",
  "do",
  "for",
  "find",
  "give",
  "i",
  "in",
  "is",
  "looking",
  "me",
  "need",
  "of",
  "on",
  "please",
  "product",
  "show",
  "tell",
  "the",
  "to",
  "what",
  "which",
  "with",
  "want",
  "you",
]);

function normalizeQuery(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function meaningfulTokens(value) {
  return normalizeQuery(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

module.exports = { meaningfulTokens, normalizeQuery };
