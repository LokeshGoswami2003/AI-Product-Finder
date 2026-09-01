const { ExactResolver } = require("./exact-resolver");
const { LexicalIndex } = require("./lexical-index");
const { reciprocalRankFusion } = require("./rank-fusion");
const { resolveExplicitRegion } = require("./region");
const {
  analyzeRequirements,
  rankProductsByRequirements,
} = require("./requirement-ranker");

const PLURAL_CONTEXT_PATTERN =
  /\b(?:them|they|their|these|those|both|all of them|which (?:one|product|option|is|has|would)|among them|compare them|compare these|compare those|the options|the products)\b/i;
const SINGULAR_CONTEXT_PATTERN =
  /\b(?:it|its|this product|that product|the product|same product|former|latter)\b/i;
const CONTINUATION_PATTERN =
  /^(?:please\s+)?(?:and\b|also\b|what about\b|how about\b|why\b|how so\b|tell me more\b|more details\b|explain\b|yes\b|no\b)/i;
const DOCUMENT_FOLLOW_UP_PATTERN =
  /^(?:please\s+)?(?:(?:show|open|check|review|explain|summarize)\s+)?(?:the\s+)?(?:tds|sds|safety data|technical data|technical properties|properties|specification|details)\b/i;
const SHORT_CONSTRAINT_PATTERN = /^(?:in|for)\s+[a-z0-9 .,&'-]+\??$/i;
const ORDINALS = [
  /\b(?:first|1st)\b/i,
  /\b(?:second|2nd)\b/i,
  /\b(?:third|3rd)\b/i,
];
const OTHER_PRODUCTS_PATTERN =
  /\b(?:other|another|alternatives?|more options?)\b/i;

function sourceFor(product) {
  return {
    id: `product:${product.fgmn}`,
    title: product.displayName,
    url: product.links.detail,
    fgmn: product.fgmn,
  };
}

function selectContextProducts(query, products) {
  const ordinalProducts = [];
  for (let index = 0; index < ORDINALS.length; index += 1) {
    if (ORDINALS[index].test(query) && products[index])
      ordinalProducts.push(products[index]);
  }
  if (ordinalProducts.length > 0) return ordinalProducts;
  if (SINGULAR_CONTEXT_PATTERN.test(query)) return products.slice(0, 1);
  if (
    PLURAL_CONTEXT_PATTERN.test(query) ||
    CONTINUATION_PATTERN.test(query.trim()) ||
    DOCUMENT_FOLLOW_UP_PATTERN.test(query.trim()) ||
    SHORT_CONSTRAINT_PATTERN.test(query.trim())
  ) {
    return products;
  }
  return [];
}

class ProductRetriever {
  constructor({ products, memberships, vectorSearch = null }) {
    this.products = new Map(products.map((product) => [product.fgmn, product]));
    this.memberships = memberships;
    this.exactResolver = new ExactResolver(products);
    this.lexicalIndex = new LexicalIndex(products);
    this.vectorSearch = vectorSearch;
  }

  async retrieve(query, { queryVector, limit = 5, context = {} } = {}) {
    const exact =
      this.exactResolver.resolve(query) ||
      this.exactResolver.resolveInText(query);
    if (exact?.type !== "ambiguous") {
      if (exact) {
        return {
          outcome: "exact",
          region: resolveExplicitRegion(query),
          results: exact.products.map((product) => ({
            product,
            sources: [sourceFor(product)],
          })),
        };
      }
    }

    if (exact?.type === "ambiguous" && exact.products.length <= 3) {
      return {
        outcome: "multi-exact",
        region: resolveExplicitRegion(query),
        results: exact.products.map((product) => ({
          product,
          sources: [sourceFor(product)],
        })),
      };
    }

    const asksForOtherProducts = OTHER_PRODUCTS_PATTERN.test(query);
    const contextProducts = (context.recentProductFgmns || [])
      .map((fgmn) => this.products.get(fgmn))
      .filter(Boolean);
    const selectedContextProducts = asksForOtherProducts
      ? []
      : selectContextProducts(query, contextProducts);
    if (selectedContextProducts.length > 0) {
      return {
        outcome: "contextual",
        region: resolveExplicitRegion(query),
        results: selectedContextProducts.map((product) => ({
          product,
          sources: [sourceFor(product)],
        })),
      };
    }

    const contextSearchText = contextProducts
      .map(
        (product) =>
          `${product.displayName} ${product.searchText || ""} ${product.description || ""}`,
      )
      .join(" ");
    const searchQuery =
      asksForOtherProducts && context.lastProductRequest
        ? `${context.lastProductRequest} ${contextSearchText} ${query}`
        : query;
    const excludedFgmns = asksForOtherProducts
      ? new Set(context.recentProductFgmns || [])
      : new Set();
    const requirementAware = analyzeRequirements(searchQuery).length > 0;
    const lexical = this.lexicalIndex
      .search(searchQuery, requirementAware ? this.products.size : 25)
      .filter((result) => !excludedFgmns.has(result.fgmn));
    const requirementRanking = rankProductsByRequirements(
      searchQuery,
      [...this.products.values()].filter(
        (product) => !excludedFgmns.has(product.fgmn),
      ),
      lexical,
    );
    const rankings = [requirementRanking.results];
    if (queryVector && this.vectorSearch) {
      rankings.push(this.vectorSearch.search(queryVector));
    }

    let fused = reciprocalRankFusion(rankings, { limit: Math.max(limit, 25) });
    if (requirementRanking.eligibleFgmns) {
      fused = fused.filter((result) =>
        requirementRanking.eligibleFgmns.has(result.fgmn),
      );
    }
    const region = resolveExplicitRegion(query);
    if (region) {
      if (!this.memberships?.complete) {
        return {
          outcome: "clarification",
          reason: "region-memberships-unavailable",
          region,
          results: [],
        };
      }
      const allowed = new Set(
        this.memberships.facetToProducts[`availability:${region.id}`] || [],
      );
      fused = fused.filter((result) => allowed.has(result.fgmn));
    }

    const results = fused.slice(0, limit).map((result) => {
      const product = this.products.get(result.fgmn);
      return { product, sources: [sourceFor(product)] };
    });

    return {
      outcome:
        results.length === 0
          ? "no-evidence"
          : exact
            ? "clarification"
            : "recommendation",
      region,
      requirements: requirementRanking.requirements,
      results,
    };
  }
}

module.exports = { ProductRetriever, selectContextProducts, sourceFor };
