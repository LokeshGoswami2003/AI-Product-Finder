const assert = require('node:assert/strict')
const test = require('node:test')

const {
  EastmanDocumentClient,
  extractHtmlText,
  parseSdsOptions,
  selectSdsOption,
} = require('../src/documents/eastman-document-client')

const product = {
  fgmn: '71103853',
  displayName: 'AdapT 100',
  documents: { hasTds: true, hasSds: true },
  links: {
    tds: 'https://productcatalog.eastman.com/tds/ProdDatasheet.aspx?product=71103853',
    sds: 'https://ws.eastman.com/ProductCatalogApps/PageControllers/MSDSAll_PC.aspx?Product=71103853',
  },
}

const sdsListing = `
  <a href="javascript:ShowMSDS('P_REP=44&amp;P_RES=9009','71103853');">
    Generic GHS SDS&nbsp;(English)
  </a>
  <a href="javascript:ShowMSDS('P_REP=112&amp;P_RES=9009','71103853');">
    India&nbsp;(English)
  </a>
`

test('document helpers preserve useful structure and select a requested SDS location', () => {
  assert.equal(
    extractHtmlText('<body><h1>Technical Data</h1><p>Density: 1.04 g/cm3</p></body>'),
    'Technical Data\nDensity: 1.04 g/cm3',
  )

  const options = parseSdsOptions(sdsListing)
  assert.equal(options.length, 2)
  assert.equal(selectSdsOption(options, 'Is it safe to handle in India?').label, 'India (English)')
  assert.equal(
    selectSdsOption(options, 'Show the English SDS').label,
    'Generic GHS SDS (English)',
  )
})

test('document enrichment fetches TDS HTML and the region-aware SDS PDF', async () => {
  const calls = []
  const client = new EastmanDocumentClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if (url.includes('ProdDatasheet')) {
        return new Response(
          '<body><h1>AdapT 100</h1><p>Density: 1.04 g/cm3</p></body>',
          { headers: { 'Content-Type': 'text/html' } },
        )
      }
      if (url.includes('MSDSAll_PC')) {
        return new Response(sdsListing, {
          headers: { 'Content-Type': 'text/html' },
        })
      }
      return new Response('%PDF-test', {
        headers: { 'Content-Type': 'application/pdf' },
      })
    },
    pdfTextExtractor: async (buffer) => {
      assert.match(buffer.toString(), /^%PDF/)
      return 'SECTION 2: Hazard identification\nWear appropriate protective equipment.'
    },
  })

  const documents = await client.enrichProduct(
    product,
    { includeTds: true, includeSds: true },
    'What are the properties and handling requirements in India?',
  )

  assert.deepEqual(documents.map(({ type, status }) => [type, status]), [
    ['sds', 'available'],
    ['tds', 'available'],
  ])
  assert.equal(documents[0].label, 'India (English)')
  assert.match(documents[0].text, /protective equipment/)
  assert.match(documents[1].text, /1\.04 g\/cm3/)
  assert.equal(calls.length, 3)
  assert.equal(calls[2].options.method, 'POST')
  assert.match(calls[2].options.body.toString(), /P_REP%3D112/)
})

test('document enrichment exposes endpoint failures without failing catalog answers', async () => {
  const client = new EastmanDocumentClient({
    fetchImpl: async () => new Response('Unavailable', { status: 503 }),
  })

  const documents = await client.enrichProduct(
    product,
    { includeTds: true, includeSds: false },
    'Tell me about AdapT 100',
  )

  assert.equal(documents[0].status, 'unavailable')
  assert.equal(documents[0].reason, 'fetch-failed')
  assert.equal(documents[0].source.url, product.links.tds)
})
