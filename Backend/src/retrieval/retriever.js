const { ExactResolver } = require('./exact-resolver')
const { LexicalIndex } = require('./lexical-index')
const { reciprocalRankFusion } = require('./rank-fusion')
const { resolveExplicitRegion } = require('./region')

function sourceFor(product) {
  return {
    id: `product:${product.fgmn}`,
    title: product.displayName,
    url: product.links.detail,
    fgmn: product.fgmn,
  }
}

class ProductRetriever {
  constructor({ products, memberships, vectorSearch = null }) {
    this.products = new Map(products.map((product) => [product.fgmn, product]))
    this.memberships = memberships
    this.exactResolver = new ExactResolver(products)
    this.lexicalIndex = new LexicalIndex(products)
    this.vectorSearch = vectorSearch
  }

  async retrieve(query, { queryVector, limit = 5 } = {}) {
    const exact = this.exactResolver.resolve(query) || this.exactResolver.resolveInText(query)
    if (exact?.type !== 'ambiguous') {
      if (exact) {
        return {
          outcome: 'exact',
          region: resolveExplicitRegion(query),
          results: exact.products.map((product) => ({
            product,
            sources: [sourceFor(product)],
          })),
        }
      }
    }

    const lexical = this.lexicalIndex.search(query)
    const rankings = [lexical]
    if (queryVector && this.vectorSearch) {
      rankings.push(this.vectorSearch.search(queryVector))
    }

    let fused = reciprocalRankFusion(rankings, { limit: Math.max(limit, 25) })
    const region = resolveExplicitRegion(query)
    if (region) {
      if (!this.memberships?.complete) {
        return {
          outcome: 'clarification',
          reason: 'region-memberships-unavailable',
          region,
          results: [],
        }
      }
      const allowed = new Set(
        this.memberships.facetToProducts[`availability:${region.id}`] || [],
      )
      fused = fused.filter((result) => allowed.has(result.fgmn))
    }

    const results = fused.slice(0, limit).map((result) => {
      const product = this.products.get(result.fgmn)
      return { product, sources: [sourceFor(product)] }
    })

    return {
      outcome: results.length === 0 ? 'no-evidence' : exact ? 'clarification' : 'recommendation',
      region,
      results,
    }
  }
}

module.exports = { ProductRetriever, sourceFor }
