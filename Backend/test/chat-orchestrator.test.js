const assert = require('node:assert/strict')
const test = require('node:test')

const { buildRetrievalPlan, ChatOrchestrator } = require('../src/chat/orchestrator')

const product = {
  fgmn: '71103853',
  displayName: 'AdapT 100',
  description: 'MDEA-based solvent for selective H2S removal.',
  documents: { hasTds: true, hasSds: true },
  links: {
    detail: 'https://www.eastman.com/product',
    tds: 'https://productcatalog.eastman.com/tds',
    sds: 'https://ws.eastman.com/sds',
  },
}
const retrieval = {
  outcome: 'exact',
  results: [
    {
      product,
      sources: [{ id: 'product:71103853', url: 'https://www.eastman.com/product' }],
    },
  ],
}

test('chat orchestration retrieves before generation and bounds model evidence', async () => {
  let request
  const orchestrator = new ChatOrchestrator({
    retriever: { retrieve: async () => retrieval },
    documentClient: {
      enrichProduct: async (_product, plan) => [
        {
          type: 'tds',
          status: 'available',
          label: 'Technical data sheet',
          text: 'Density: 1.04 g/cm3',
          source: { id: 'tds:71103853', url: product.links.tds },
          plan,
        },
      ],
    },
    modelClient: {
      createChatCompletion: async (value) => {
        request = value
        return {
          choices: [{ message: { content: 'AdapT 100 matches the supplied evidence.' } }],
          usage: { total_tokens: 42 },
        }
      },
    },
  })

  const answer = await orchestrator.answer({
    message: 'Tell me about AdapT 100',
    history: [],
    signal: AbortSignal.timeout(1_000),
  })

  assert.match(answer.text, /AdapT 100/)
  assert.match(request.messages.at(-1).content, /71103853/)
  assert.match(request.messages.at(-1).content, /Density: 1\.04 g\/cm3/)
  assert.match(request.messages[0].content, /only from the supplied evidence/i)
  assert.match(request.messages[0].content, /experienced Eastman product sales representative/i)
  assert.deepEqual(answer.plan, {
    mode: 'product-detail',
    maxProducts: 1,
    includeTds: true,
    includeSds: false,
  })
  assert.deepEqual(
    answer.retrieval.results[0].sources.map((source) => source.id),
    ['product:71103853', 'tds:71103853'],
  )
  assert.deepEqual(answer.usage, { total_tokens: 42 })
})

test('chat orchestration does not call the model without evidence', async () => {
  let modelCalled = false
  const orchestrator = new ChatOrchestrator({
    retriever: {
      retrieve: async () => ({ outcome: 'no-evidence', results: [] }),
    },
    documentClient: {
      enrichProduct: async () => assert.fail('must not fetch documents'),
    },
    modelClient: {
      createChatCompletion: async () => {
        modelCalled = true
      },
    },
  })

  const answer = await orchestrator.answer({
    message: 'Unknown product',
    history: [],
  })

  assert.equal(modelCalled, false)
  assert.match(answer.text, /could not find enough catalog evidence/i)
})

test('retrieval planning adds SDS only for safety intent and bounds comparisons', () => {
  assert.deepEqual(
    buildRetrievalPlan('Compare safe handling and PPE for these options', {
      outcome: 'recommendation',
    }),
    {
      mode: 'comparison',
      maxProducts: 3,
      includeTds: true,
      includeSds: true,
    },
  )
  assert.deepEqual(
    buildRetrievalPlan('Find a coating resin', { outcome: 'recommendation' }),
    {
      mode: 'recommendation',
      maxProducts: 3,
      includeTds: true,
      includeSds: false,
    },
  )
})

test('safety scenario passes catalog, TDS, and SDS evidence to the sales response', async () => {
  let requestedPlan
  let modelRequest
  const orchestrator = new ChatOrchestrator({
    retriever: { retrieve: async () => retrieval },
    documentClient: {
      enrichProduct: async (_product, plan) => {
        requestedPlan = plan
        return [
          {
            type: 'tds',
            status: 'available',
            label: 'Technical data sheet',
            text: 'Flash point: 138 C',
            source: { id: 'tds:71103853', url: product.links.tds },
          },
          {
            type: 'sds',
            status: 'available',
            label: 'India (English)',
            text: 'Use protective gloves.',
            source: { id: 'sds:71103853', url: product.links.sds },
          },
        ]
      },
    },
    modelClient: {
      createChatCompletion: async (request) => {
        modelRequest = request
        return {
          choices: [
            {
              message: {
                content:
                  'AdapT 100 fits selective H2S removal.\n\n### Safety\n- Use protective gloves.\n\n### Next step\nConfirm the operating region.',
              },
            },
          ],
        }
      },
    },
  })

  const answer = await orchestrator.answer({
    message: 'What SDS handling information applies to AdapT 100 in India?',
    history: [],
  })

  assert.equal(requestedPlan.includeSds, true)
  assert.match(modelRequest.messages.at(-1).content, /India \(English\)/)
  assert.match(modelRequest.messages.at(-1).content, /Use protective gloves/)
  assert.match(answer.text, /### Next step/)
  assert.deepEqual(
    answer.retrieval.results[0].sources.map((source) => source.id),
    ['product:71103853', 'tds:71103853', 'sds:71103853'],
  )
})
