const assert = require('node:assert/strict')
const test = require('node:test')

const { ChatOrchestrator } = require('../src/chat/orchestrator')

const product = {
  fgmn: '71103853',
  displayName: 'AdapT 100',
  description: 'MDEA-based solvent for selective H2S removal.',
  documents: { hasTds: true, hasSds: true },
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
  assert.match(request.messages[0].content, /only from the supplied evidence/i)
  assert.deepEqual(answer.usage, { total_tokens: 42 })
})

test('chat orchestration does not call the model without evidence', async () => {
  let modelCalled = false
  const orchestrator = new ChatOrchestrator({
    retriever: {
      retrieve: async () => ({ outcome: 'no-evidence', results: [] }),
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

