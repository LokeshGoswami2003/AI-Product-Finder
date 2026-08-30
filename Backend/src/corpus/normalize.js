const { createHash } = require('node:crypto')
const cheerio = require('cheerio')

const { buildProductUrls } = require('../urls/eastman')

const SCHEMA_VERSION = 1
const PARSER_VERSION = 1

function hashText(value) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeText(value) {
  const document = cheerio.load(`<body>${value}</body>`)
  document('script, style, noscript').remove()

  return document('body')
    .text()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
}

function fallbackSlug(displayName) {
  const slug = displayName
    .replace(/™|®|©/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!slug) {
    throw new TypeError('A fallback slug could not be generated')
  }

  return slug
}

function normalizeCatalog(catalog, retrievedAt) {
  const { filters, products } = catalog.productDetails

  const normalizedProducts = products.map((product) => {
    const slug = fallbackSlug(product.DisplayName)
    const description = normalizeText(product.ShortDescription)

    return {
      fgmn: product.FGMN,
      displayName: normalizeText(product.DisplayName),
      sortName: normalizeText(product.SortName),
      description,
      searchText: normalizeText(`${product.DisplayName} ${product.ShortDescription}`).toLowerCase(),
      documents: {
        hasTds: product.DisplayTDS,
        hasSds: product.DisplaySDS,
        hasSalesSpecification: product.DisplaySalesSpec,
      },
      links: buildProductUrls({ fgmn: product.FGMN, slug }),
      linkSource: 'generated-fallback',
    }
  })

  const facets = filters.map((facet) => ({
    categoryName: facet.categoryName,
    categoryTitle: facet.categoryTitle,
    values: facet.values.map((value) => ({
      key: `${facet.categoryName}:${value.id}`,
      id: value.id,
      name: value.name,
      lookupName: value.lookupName,
      count: value.count,
      level: value.level,
      parentId: value.parentId || null,
    })),
  }))

  const chunks = normalizedProducts.map((product) => {
    const text = `${product.displayName}\n${product.description}`
    return {
      id: `product:${product.fgmn}:summary`,
      fgmn: product.fgmn,
      displayName: product.displayName,
      sectionType: 'product-summary',
      sectionTitle: 'Product summary',
      text,
      facetIds: [],
      sourceUrl: product.links.detail,
      retrievedAt,
      sourceRevisionAt: null,
      contentHash: hashText(text),
      parserVersion: PARSER_VERSION,
      schemaVersion: SCHEMA_VERSION,
    }
  })

  return { products: normalizedProducts, facets, chunks }
}

module.exports = {
  PARSER_VERSION,
  SCHEMA_VERSION,
  fallbackSlug,
  hashText,
  normalizeCatalog,
  normalizeText,
}
