const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseResearch,
  PublicWebResearchClient,
} = require("../src/research/public-web");

test("public research accepts only official Eastman HTTPS sources", () => {
  const research = parseResearch(
    JSON.stringify({
      overview: " Useful public evidence. ",
      findings: [
        {
          claim: "An official supported claim.",
          sourceTitle: "Eastman product page",
          sourceUrl: "https://www.eastman.com/en/products/example",
        },
        {
          claim: "A third-party claim.",
          sourceTitle: "Other site",
          sourceUrl: "https://example.com/eastman",
        },
        {
          claim: "A lookalike-domain claim.",
          sourceTitle: "Lookalike",
          sourceUrl: "https://www.eastman.com.example.com/product",
        },
      ],
    }),
  );

  assert.equal(research.overview, "Useful public evidence.");
  assert.deepEqual(research.findings, [
    {
      claim: "An official supported claim.",
      sourceTitle: "Eastman product page",
      sourceUrl: "https://www.eastman.com/en/products/example",
    },
  ]);
});

test("public research requests required domain-filtered gateway search", async () => {
  let request;
  const client = new PublicWebResearchClient({
    modelClient: {
      createChatCompletion: async (value) => {
        request = value;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overview: "Official evidence.",
                  findings: [
                    {
                      claim: "The page discusses adhesive applications.",
                      sourceTitle: "Eastman adhesives",
                      sourceUrl:
                        "https://www.eastman.com/en/products/adhesives",
                    },
                  ],
                }),
              },
            },
          ],
        };
      },
    },
    maxResults: 3,
  });

  const result = await client.research({
    message: "Find adhesive guidance",
    products: [{ displayName: "Test resin", fgmn: "100" }],
  });

  assert.equal(result.status, "available");
  assert.equal(request.toolChoice, "required");
  assert.equal(request.tools[0].type, "vercel:perplexity_search");
  assert.deepEqual(request.tools[0].config.search_domain_filter, [
    "eastman.com",
  ]);
  assert.equal(request.tools[0].config.max_results, 3);
  assert.match(request.tools[0].config.query, /Test resin FGMN 100/);
  assert.deepEqual(result.sources, [
    {
      id: "web:eastman:1",
      title: "Eastman adhesives",
      url: "https://www.eastman.com/en/products/adhesives",
    },
  ]);
});

test("public research degrades safely when gateway search fails", async () => {
  const client = new PublicWebResearchClient({
    modelClient: {
      createChatCompletion: async () => {
        throw new Error("search unavailable");
      },
    },
  });

  assert.deepEqual(await client.research({ message: "Find a product" }), {
    status: "unavailable",
    overview: null,
    findings: [],
    sources: [],
  });
});
