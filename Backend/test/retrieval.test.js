const assert = require('node:assert/strict')
const test = require('node:test')

const { ExactResolver } = require('../src/retrieval/exact-resolver')
const { reciprocalRankFusion } = require('../src/retrieval/rank-fusion')
const { resolveExplicitRegion } = require('../src/retrieval/region')
const { ProductRetriever } = require('../src/retrieval/retriever')
const { VectorSearch } = require('../src/retrieval/vector-search')

const products = [
  {
    fgmn: '100',
    displayName: 'AdapT™ 100',
    sortName: 'AdapT 100',
    description: 'Plasticizer for coatings',
    searchText: 'adapt 100 plasticizer coatings',
    links: { detail: 'https://www.eastman.com/en/products/product-detail/100/adapt-100' },
  },
  {
    fgmn: '201',
    displayName: 'AdapT 201',
    sortName: 'AdapT 201',
    description: 'Additive for adhesives',
    searchText: 'adapt 201 additive adhesives',
    links: { detail: 'https://www.eastman.com/en/products/product-detail/201/adapt-201' },
  },
]

test('exact resolver matches identifiers and trademark-normalized names', () => {
  const resolver = new ExactResolver(products)
  assert.equal(resolver.resolve('100').products[0].fgmn, '100')
  assert.equal(resolver.resolve('adapt 100').products[0].fgmn, '100')
  assert.equal(resolver.resolveInText('Tell me about AdapT 100').products[0].fgmn, '100')
  assert.equal(resolver.resolveInText('Compare AdapT 100 and AdapT 201').type, 'ambiguous')
})

test('vector search validates dimensions and ranks cosine similarity', () => {
  const search = new VectorSearch(
    [
      { fgmn: '100', chunkId: 'a', vector: [1, 0] },
      { fgmn: '201', chunkId: 'b', vector: [0, 1] },
    ],
    2,
  )
  assert.equal(search.search([0.9, 0.1])[0].fgmn, '100')
  assert.throws(() => search.search([1]))
})

test('RRF deduplicates products within and across rankings', () => {
  const results = reciprocalRankFusion([
    [{ fgmn: '100' }, { fgmn: '100' }, { fgmn: '201' }],
    [{ fgmn: '201' }, { fgmn: '100' }],
  ])
  assert.deepEqual(results.map((result) => result.fgmn), ['100', '201'])
})

test('explicit region resolver recognizes supported aliases only', () => {
  assert.deepEqual(resolveExplicitRegion('available in APAC'), {
    id: '1',
    name: 'Asia Pacific',
  })
  assert.equal(resolveExplicitRegion('global availability'), null)
})

test('retriever returns exact, lexical, and safe incomplete-region outcomes', async () => {
  const retriever = new ProductRetriever({
    products,
    memberships: { complete: false, facetToProducts: {} },
  })

  assert.equal((await retriever.retrieve('AdapT 100')).outcome, 'exact')
  assert.equal((await retriever.retrieve('adhesive additive')).results[0].product.fgmn, '201')
  assert.equal(
    (await retriever.retrieve('coating product available in APAC')).outcome,
    'clarification',
  )
})
