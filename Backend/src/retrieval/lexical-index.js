const MiniSearch = require('minisearch')

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
    return this.index.search(query).slice(0, limit).map((result, index) => ({
      fgmn: result.fgmn,
      product: this.products.get(result.fgmn),
      score: result.score,
      rank: index + 1,
    }))
  }
}

module.exports = { LexicalIndex }

