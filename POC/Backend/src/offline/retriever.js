const MiniSearch = require("minisearch");

const {
  MAX_SELECTED_PRODUCTS,
  documentLinkSources,
  indexProducts,
  productSource,
} = require("../chat/catalog");
const { meaningfulTokens, normalizeQuery } = require("./normalization");

const FOLLOW_UP_PATTERN =
  /\b(?:it|its|that product|this product|the product|that one)\b/i;

function sourceForId(product, sourceId) {
  return [productSource(product), ...documentLinkSources(product)].find(
    (source) => source.id === sourceId,
  );
}

function resultForProduct(product, sourceIds) {
  const sources = sourceIds?.length
    ? sourceIds.map((id) => sourceForId(product, id)).filter(Boolean)
    : [productSource(product), ...documentLinkSources(product)];
  return { product, documents: [], sources };
}

function productOverview(product) {
  const documents = [];
  if (product.documents?.hasTds) documents.push("technical data sheet");
  if (product.documents?.hasSds) documents.push("safety data sheet");
  if (product.documents?.hasSalesSpecification) {
    documents.push("sales specification");
  }
  const documentText =
    documents.length > 0
      ? `\n\n### Available documents\n${documents.map((name) => `- ${name}`).join("\n")}`
      : "";
  return `### ${product.displayName}\n\n${product.description}${documentText}\n\n### Next step\nWhat application or property would you like to narrow down?`;
}

function noMatchAnswer() {
  return "I couldn’t find a sufficiently confident match in this offline product corpus. Try an exact product name or FGMN, or describe the application and material you need.";
}

class OfflineRetriever {
  constructor({ products, answers = [], questions = [] }) {
    if (!Array.isArray(products) || products.length === 0) {
      throw new TypeError("A product catalog is required");
    }
    this.products = products;
    this.productsByFgmn = indexProducts(products);
    this.answersById = new Map(
      answers.map((answer) => [answer.answerId, answer]),
    );
    this.exactQuestions = new Map();
    this.names = products
      .map((product) => ({
        normalized: normalizeQuery(product.displayName),
        product,
      }))
      .filter(({ normalized }) => normalized)
      .sort((left, right) => right.normalized.length - left.normalized.length);

    this.questionIndex = new MiniSearch({
      fields: ["text", "keywords", "products"],
      storeFields: ["answerId"],
      idField: "questionId",
      searchOptions: { boost: { text: 3, products: 2, keywords: 1 } },
    });
    const questionDocuments = questions.map((question) => {
      const answer = this.answersById.get(question.answerId);
      const normalized = normalizeQuery(
        question.normalizedText || question.text,
      );
      this.exactQuestions.set(normalized, question.answerId);
      return {
        questionId: question.questionId,
        answerId: question.answerId,
        text: normalized,
        keywords: (answer?.keywords || []).join(" "),
        products: (question.entities?.products || []).join(" "),
      };
    });
    if (questionDocuments.length > 0) {
      this.questionIndex.addAll(questionDocuments);
    }

    this.productIndex = new MiniSearch({
      fields: ["name", "description", "searchText"],
      storeFields: ["fgmn"],
      idField: "fgmn",
      searchOptions: { boost: { name: 4, searchText: 2, description: 1 } },
    });
    this.productIndex.addAll(
      products.map((product) => ({
        fgmn: String(product.fgmn),
        name: product.displayName,
        description: product.description,
        searchText: product.searchText || "",
      })),
    );
  }

  explicitProducts(message) {
    const normalized = normalizeQuery(message);
    const selected = [];
    const seen = new Set();
    for (const match of normalized.matchAll(/\b\d{7,10}\b/g)) {
      const product = this.productsByFgmn.get(match[0]);
      if (product && !seen.has(product.fgmn)) {
        selected.push(product);
        seen.add(product.fgmn);
      }
    }
    for (const { normalized: name, product } of this.names) {
      if (selected.length >= MAX_SELECTED_PRODUCTS || seen.has(product.fgmn)) {
        continue;
      }
      if (` ${normalized} `.includes(` ${name} `)) {
        selected.push(product);
        seen.add(product.fgmn);
      }
    }
    return selected;
  }

  answerRecord(answer, outcome = "exact") {
    const products = answer.fgmns
      .map((fgmn) => this.productsByFgmn.get(String(fgmn)))
      .filter(Boolean);
    return {
      text: answer.answer,
      outcome,
      results: products.map((product) =>
        resultForProduct(product, answer.sourceIds),
      ),
    };
  }

  searchQuestions(normalized) {
    if (this.questionIndex.documentCount === 0) return null;
    const results = this.questionIndex.search(normalized, {
      combineWith: "AND",
      fuzzy: (term) => (term.length >= 5 ? 0.15 : false),
      prefix: false,
    });
    if (results.length === 0) return null;
    const first = results[0];
    const second = results[1];
    if (first.score < 2 || (second && first.score < second.score * 1.15)) {
      return null;
    }
    const answer = this.answersById.get(first.answerId);
    return answer ? this.answerRecord(answer, "lexical") : null;
  }

  searchProducts(message) {
    const tokens = meaningfulTokens(message);
    if (tokens.length === 0) return [];
    const minimumMatchedTerms = Math.min(2, new Set(tokens).size);
    const results = this.productIndex.search(tokens.join(" "), {
      combineWith: "OR",
      fuzzy: (term) => (term.length >= 5 ? 0.15 : false),
      prefix: false,
    });
    return results
      .filter(
        (result) =>
          result.score >= 1 &&
          new Set(result.queryTerms || []).size >= minimumMatchedTerms,
      )
      .slice(0, MAX_SELECTED_PRODUCTS)
      .map((result) => this.productsByFgmn.get(String(result.fgmn)))
      .filter(Boolean);
  }

  retrieve(message, retrievalContext = {}) {
    const normalized = normalizeQuery(message);
    const exactAnswerId = this.exactQuestions.get(normalized);
    if (exactAnswerId) {
      return this.answerRecord(this.answersById.get(exactAnswerId));
    }

    const explicitProducts = this.explicitProducts(message);
    if (explicitProducts.length === 1) {
      const product = explicitProducts[0];
      const authored = [...this.answersById.values()].find(
        (answer) =>
          answer.fgmns.length === 1 &&
          String(answer.fgmns[0]) === String(product.fgmn) &&
          answer.intent === "product_overview",
      );
      return authored
        ? this.answerRecord(authored, "entity")
        : {
            text: productOverview(product),
            outcome: "entity",
            results: [resultForProduct(product)],
          };
    }
    if (explicitProducts.length > 1) {
      return {
        text: `I found multiple named products: ${explicitProducts.map((product) => product.displayName).join(", ")}. Please ask about one product at a time while comparison answers are being added to the offline corpus.`,
        outcome: "clarification",
        results: explicitProducts.map((product) => resultForProduct(product)),
      };
    }

    const recentFgmns = retrievalContext.recentProductFgmns || [];
    if (FOLLOW_UP_PATTERN.test(message) && recentFgmns.length === 1) {
      const product = this.productsByFgmn.get(String(recentFgmns[0]));
      if (product) {
        return {
          text: productOverview(product),
          outcome: "context",
          results: [resultForProduct(product)],
        };
      }
    }

    const questionMatch = this.searchQuestions(normalized);
    if (questionMatch) return questionMatch;

    const products = this.searchProducts(message);
    if (products.length === 1) {
      return {
        text: productOverview(products[0]),
        outcome: "lexical-product",
        results: [resultForProduct(products[0])],
      };
    }
    if (products.length > 1) {
      return {
        text: `I found these possible matches in the offline catalog:\n\n${products.map((product) => `- **${product.displayName}** — ${product.description}`).join("\n")}\n\nAsk about one exact product name or FGMN for its stored profile.`,
        outcome: "product-list",
        results: products.map((product) => resultForProduct(product)),
      };
    }

    return { text: noMatchAnswer(), outcome: "no-match", results: [] };
  }
}

module.exports = {
  OfflineRetriever,
  noMatchAnswer,
  productOverview,
  resultForProduct,
};
