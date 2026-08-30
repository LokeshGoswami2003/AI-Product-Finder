const assert = require('node:assert/strict')
const { mkdtemp, readFile, rm } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { buildCatalogRelease } = require('../src/corpus/artifacts')
const { catalogSchema } = require('../src/corpus/catalog-schema')
const { fallbackSlug, normalizeCatalog, normalizeText } = require('../src/corpus/normalize')

const fixturePath = path.join(__dirname, 'fixtures', 'catalog.json')

test('catalog schema converts source booleans and counts', async () => {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  const catalog = catalogSchema.parse(fixture)
  const product = catalog.productDetails.products[0]

  assert.equal(product.DisplayTDS, true)
  assert.equal(product.DisplaySalesSpec, false)
  assert.equal(catalog.productDetails.filters[0].values[0].count, 1)
})

test('normalization removes unsafe markup and creates searchable chemical text', async () => {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  const catalog = catalogSchema.parse(fixture)
  const normalized = normalizeCatalog(catalog, '2026-08-30T00:00:00.000Z')

  assert.equal(normalizeText('<p>A&nbsp; B</p>'), 'A B')
  assert.equal(fallbackSlug('AdapT™ 100'), 'adapt-100')
  assert.equal(normalized.products[0].description, 'Hydrogen sulfide: H2S.')
  assert.doesNotMatch(normalized.products[0].searchText, /unsafe/)
})

test('local ingestion atomically creates and activates a partial release', async (context) => {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'product-finder-'))
  context.after(() => rm(artifactDir, { recursive: true, force: true }))

  const result = await buildCatalogRelease({
    sourcePath: fixturePath,
    artifactDir,
    now: new Date('2026-08-30T00:00:00.000Z'),
    expectedProductCount: 1,
  })
  const pointer = JSON.parse(await readFile(path.join(artifactDir, 'current.json'), 'utf8'))
  const products = JSON.parse(
    await readFile(path.join(result.releaseDir, 'products.json'), 'utf8'),
  )

  assert.equal(pointer.releaseId, result.manifest.releaseId)
  assert.equal(result.report.status, 'partial')
  assert.equal(products[0].documents.hasTds, true)
})

