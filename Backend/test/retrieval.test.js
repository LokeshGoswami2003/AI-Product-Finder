const assert = require("node:assert/strict");
const test = require("node:test");

const { ExactResolver } = require("../src/retrieval/exact-resolver");
const { prepareSearchQuery } = require("../src/retrieval/lexical-index");
const { reciprocalRankFusion } = require("../src/retrieval/rank-fusion");
const { resolveExplicitRegion } = require("../src/retrieval/region");
const { ProductRetriever } = require("../src/retrieval/retriever");
const { VectorSearch } = require("../src/retrieval/vector-search");

const products = [
  {
    fgmn: "100",
    displayName: "AdapT™ 100",
    sortName: "AdapT 100",
    description: "Plasticizer for coatings",
    searchText: "adapt 100 plasticizer coatings",
    links: {
      detail:
        "https://www.eastman.com/en/products/product-detail/100/adapt-100",
    },
  },
  {
    fgmn: "201",
    displayName: "AdapT 201",
    sortName: "AdapT 201",
    description: "Additive for adhesives",
    searchText: "adapt 201 additive adhesives",
    links: {
      detail:
        "https://www.eastman.com/en/products/product-detail/201/adapt-201",
    },
  },
];

test("exact resolver matches identifiers and trademark-normalized names", () => {
  const resolver = new ExactResolver(products);
  assert.equal(resolver.resolve("100").products[0].fgmn, "100");
  assert.equal(resolver.resolve("adapt 100").products[0].fgmn, "100");
  assert.equal(
    resolver.resolveInText("Tell me about AdapT 100").products[0].fgmn,
    "100",
  );
  assert.equal(
    resolver.resolveInText("Compare AdapT 100 and AdapT 201").type,
    "ambiguous",
  );
});

test("vector search validates dimensions and ranks cosine similarity", () => {
  const search = new VectorSearch(
    [
      { fgmn: "100", chunkId: "a", vector: [1, 0] },
      { fgmn: "201", chunkId: "b", vector: [0, 1] },
    ],
    2,
  );
  assert.equal(search.search([0.9, 0.1])[0].fgmn, "100");
  assert.throws(() => search.search([1]));
});

test("RRF deduplicates products within and across rankings", () => {
  const results = reciprocalRankFusion([
    [{ fgmn: "100" }, { fgmn: "100" }, { fgmn: "201" }],
    [{ fgmn: "201" }, { fgmn: "100" }],
  ]);
  assert.deepEqual(
    results.map((result) => result.fgmn),
    ["100", "201"],
  );
});

test("explicit region resolver recognizes supported aliases only", () => {
  assert.deepEqual(resolveExplicitRegion("available in APAC"), {
    id: "1",
    name: "Asia Pacific",
  });
  assert.equal(resolveExplicitRegion("global availability"), null);
});

test("lexical query preparation removes conversational noise but keeps requirements", () => {
  assert.equal(
    prepareSearchQuery(
      "Please recommend Eastman products for coatings with strong adhesion",
    ),
    "coatings strong adhesion",
  );
  assert.equal(
    prepareSearchQuery(
      "I want polymer for my plastic bottles which should be BPA free and transparent in nature",
    ),
    "polymer plastic bottles bpa transparent",
  );
});

test("retriever returns exact, lexical, and safe incomplete-region outcomes", async () => {
  const retriever = new ProductRetriever({
    products,
    memberships: { complete: false, facetToProducts: {} },
  });

  assert.equal((await retriever.retrieve("AdapT 100")).outcome, "exact");
  assert.equal(
    (await retriever.retrieve("adhesive additive")).results[0].product.fgmn,
    "201",
  );
  assert.equal(
    (await retriever.retrieve("coating product available in APAC")).outcome,
    "clarification",
  );
});

test("retriever resolves contextual pronouns, ordinals, and alternative searches", async () => {
  const retriever = new ProductRetriever({
    products,
    memberships: { complete: false, facetToProducts: {} },
  });
  const context = {
    recentProductFgmns: ["100", "201"],
    lastProductRequest: "Compare coating and adhesive additives",
  };

  const plural = await retriever.retrieve("Compare them", { context });
  assert.equal(plural.outcome, "contextual");
  assert.deepEqual(
    plural.results.map((result) => result.product.fgmn),
    ["100", "201"],
  );

  const second = await retriever.retrieve("What does the second product do?", {
    context,
  });
  assert.deepEqual(
    second.results.map((result) => result.product.fgmn),
    ["201"],
  );

  const documentFollowUp = await retriever.retrieve("SDS?", { context });
  assert.equal(documentFollowUp.outcome, "contextual");
  assert.deepEqual(
    documentFollowUp.results.map((result) => result.product.fgmn),
    ["100", "201"],
  );

  const alternatives = await retriever.retrieve(
    "Show other options like them",
    {
      context,
    },
  );
  assert.ok(
    alternatives.results.every(
      (result) => !context.recentProductFgmns.includes(result.product.fgmn),
    ),
  );
});

test("retriever prioritizes transparent bottle polymers over generic polymer matches", async () => {
  const recommendationProducts = [
    {
      fgmn: "301",
      displayName: "Eastman Cristal One",
      sortName: "Cristal One",
      description:
        "A copolyester for thick-walled transparent containers and complex bottles.",
      searchText:
        "cristal one copolyester thick-walled transparent containers bottles",
    },
    {
      fgmn: "302",
      displayName: "Eastman Cristal EB062 copolyester",
      sortName: "Cristal EB062 Copolyester",
      description:
        "A resin developed for extrusion-blown bottles with high clarity and gloss.",
      searchText:
        "cristal eb062 copolyester resin extrusion-blown bottles high clarity gloss",
    },
    {
      fgmn: "303",
      displayName: "Eastman Tritan LX101 copolyester",
      sortName: "Tritan LX101 Copolyester",
      description:
        "An amorphous copolyester with excellent clarity for extrusion blow molding.",
      searchText:
        "tritan lx101 amorphous copolyester clarity extrusion blow molding",
    },
    {
      fgmn: "401",
      displayName: "Benzoflex 9-88 Plasticizer",
      sortName: "Benzoflex 9-88 Plasticizer",
      description:
        "A plasticizer for polymer systems, adhesives, caulks, flooring, and sealants.",
      searchText:
        "benzoflex 9-88 plasticizer polymer systems adhesives caulks flooring sealants",
    },
    {
      fgmn: "402",
      displayName: "AQ 38S Polymer",
      sortName: "AQ 38S Polymer",
      description:
        "A water-dispersible film-forming polymer for sunscreen products.",
      searchText:
        "aq 38s water dispersible film forming polymer sunscreen cosmetics",
    },
    {
      fgmn: "403",
      displayName: "DuraStar MN610 polymer natural",
      sortName: "DuraStar MN610 Polymer Natural",
      description: "A nearly water-clear polymer with good toughness.",
      searchText: "durastar mn610 water-clear polymer toughness",
    },
    {
      fgmn: "404",
      displayName: "Eastman Tritan GX100 copolyester",
      sortName: "Tritan GX100 Copolyester",
      description:
        "A glasslike-clear, BPA-free copolyester for heavy-gauge sheet applications.",
      searchText:
        "tritan gx100 glasslike clear bpa free copolyester heavy gauge sheet",
    },
  ].map((product) => ({
    ...product,
    links: {
      detail: `https://www.eastman.com/en/products/product-detail/${product.fgmn}/test-product`,
    },
  }));
  const retriever = new ProductRetriever({
    products: recommendationProducts,
    memberships: { complete: false, facetToProducts: {} },
  });
  const query =
    "I want polymer for my plastic bottles which should be BPA free and transparent in nature";
  const result = await retriever.retrieve(query, { limit: 3 });
  const identifiers = result.results.map((entry) => entry.product.fgmn);

  assert.deepEqual(new Set(identifiers), new Set(["301", "302", "303"]));
  assert.deepEqual(
    result.requirements.map((requirement) => requirement.id),
    ["container", "transparent", "bpa-free", "polymer-material"],
  );

  const exact = await retriever.retrieve(
    "Is Benzoflex 9-88 Plasticizer BPA free?",
  );
  assert.equal(exact.outcome, "exact");
  assert.equal(exact.results[0].product.fgmn, "401");
});
