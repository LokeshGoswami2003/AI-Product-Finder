const MiniSearch = require('minisearch')

const QUERY_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'compare',
  'eastman',
  'find',
  'for',
  'give',
  'i',
  'me',
  'need',
  'of',
  'or',
  'please',
  'product',
  'products',
  'recommend',
  'show',
  'some',
  'tell',
  'the',
  'these',
  'to',
  'want',
  'what',
  'which',
  'with',
])

function prepareSearchQuery(query) {
  const terms = query
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term && !QUERY_STOP_WORDS.has(term))

  return terms.length > 0 ? terms.join(' ') : query
}

class LexicalIndex {
  constructor(products) {
    this.products = new Map(products.map((product) => [product.fgmn, product]))
    this.index = new MiniSearch({
      idField: 'fgmn',
      fields: ['displayName', 'sortName', 'searchText', 'description'],
      storeFields: ['fgmn'],
      searchOptions: {
        boost: { displayName: 8, sortName: 6, searchText: 2, description: 1 },
        combineWith: 'OR',
        prefix: true,
        fuzzy: 0.15,
      },
    })
    this.index.addAll(products)
  }

  search(query, limit = 25) {
    return this.index.search(prepareSearchQuery(query)).slice(0, limit).map((result, index) => ({
      fgmn: result.fgmn,
      product: this.products.get(result.fgmn),
      score: result.score,
      rank: index + 1,
    }))
  }
}

module.exports = { LexicalIndex, prepareSearchQuery }
