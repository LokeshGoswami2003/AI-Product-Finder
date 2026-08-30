const cheerio = require('cheerio')
const { PDFParse } = require('pdf-parse')

const { assertEastmanUrl } = require('../urls/eastman')

const MAX_HTML_BYTES = 2 * 1024 * 1024
const MAX_PDF_BYTES = 5 * 1024 * 1024
const MAX_DOCUMENT_TEXT_CHARS = 10_000
const SDS_SHOW_PATH = '/ProductCatalogApps/PageControllers/MSDSShow_PC.aspx'

const LOCATION_ALIASES = new Map([
  ['united states', ['united states', 'usa', 'u.s.', 'u.s.a.']],
  ['great britain', ['great britain', 'united kingdom', 'uk', 'u.k.']],
  ['india', ['india']],
  ['canada', ['canada']],
  ['australia', ['australia']],
  ['china', ['china']],
  ['germany', ['germany']],
  ['france', ['france']],
  ['japan', ['japan']],
  ['korea', ['korea']],
  ['mexico', ['mexico']],
])

function normalizeText(value) {
  return value
    .normalize('NFKC')
    .replace(/\r/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractHtmlText(html) {
  const document = cheerio.load(html)
  document('script, style, noscript').remove()
  document('br').replaceWith('\n')
  document('p, div, li, tr, h1, h2, h3, h4, h5, h6').each((_index, element) => {
    document(element).append('\n')
  })
  return normalizeText(document('body').text())
}

function relevantExcerpt(text, query, maxChars = MAX_DOCUMENT_TEXT_CHARS) {
  const normalized = normalizeText(text)
  if (normalized.length <= maxChars) return normalized

  const queryTerms = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 4),
  )
  const blocks = normalized.split(/\n{2,}/).filter(Boolean)
  const selected = new Set(blocks.slice(0, 3))
  const scored = blocks
    .map((block, index) => ({
      block,
      index,
      score: [...queryTerms].reduce(
        (score, term) => score + (block.toLowerCase().includes(term) ? 1 : 0),
        0,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)

  let length = [...selected].reduce((total, block) => total + block.length + 2, 0)
  for (const { block } of scored) {
    if (selected.has(block) || length + block.length + 2 > maxChars) continue
    selected.add(block)
    length += block.length + 2
  }

  return blocks
    .filter((block) => selected.has(block))
    .join('\n\n')
    .slice(0, maxChars)
}

function parseSdsOptions(html) {
  const document = cheerio.load(html)
  const options = []

  document('a').each((_index, element) => {
    const href = document(element).attr('href') || ''
    const match = href.match(
      /^javascript:ShowMSDS\('([^']+)','([A-Za-z0-9_-]+)'\);?$/i,
    )
    if (!match) return

    options.push({
      requestToken: match[1],
      productId: match[2],
      label: document(element).text().normalize('NFKC').replace(/\s+/g, ' ').trim(),
    })
  })

  return options
}

function includesAlias(query, alias) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i').test(query)
}

function selectSdsOption(options, query) {
  for (const [location, aliases] of LOCATION_ALIASES) {
    if (!aliases.some((alias) => includesAlias(query, alias))) continue
    const match = options.find(
      (option) =>
        option.label.toLowerCase().startsWith(location) &&
        option.label.toLowerCase().includes('(english)'),
    )
    if (match) return match
  }

  return (
    options.find((option) => /generic ghs sds\s*\(english\)/i.test(option.label)) ||
    options.find((option) => /\(english\)/i.test(option.label)) ||
    null
  )
}

function documentSource(product, type, title) {
  return {
    id: `${type}:${product.fgmn}`,
    title,
    url: product.links[type],
    fgmn: product.fgmn,
  }
}

function unavailableDocument(product, type, reason) {
  const label = type === 'tds' ? 'Technical data sheet' : 'Safety data sheets'
  return {
    type,
    status: 'unavailable',
    reason,
    source: documentSource(product, type, `${product.displayName} — ${label}`),
  }
}

function classifyDocumentError(error) {
  if (error?.name === 'TimeoutError') return 'request-timeout'
  if (error?.name === 'AbortError') return 'request-aborted'
  if (/PDF/i.test(error?.message || '')) return 'invalid-pdf'
  return 'fetch-failed'
}

async function defaultPdfTextExtractor(buffer) {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result.text
  } finally {
    await parser.destroy()
  }
}

class EastmanDocumentClient {
  constructor({
    fetchImpl = fetch,
    pdfTextExtractor = defaultPdfTextExtractor,
    timeoutMs = 15_000,
    cacheTtlMs = 60 * 60 * 1000,
  } = {}) {
    this.fetchImpl = fetchImpl
    this.pdfTextExtractor = pdfTextExtractor
    this.timeoutMs = timeoutMs
    this.cacheTtlMs = cacheTtlMs
    this.cache = new Map()
  }

  async fetchResponse(url, options = {}, signal) {
    assertEastmanUrl(url)
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs)
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal
    const response = await this.fetchImpl(url, { ...options, signal: combinedSignal })

    if (!response.ok) {
      throw new Error(`Eastman document endpoint returned HTTP ${response.status}`)
    }
    return response
  }

  async readText(response, maxBytes) {
    const declaredLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error('Eastman document response exceeds the configured size limit')
    }
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error('Eastman document response exceeds the configured size limit')
    }
    return text
  }

  async readBytes(response, maxBytes) {
    const declaredLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error('Eastman document response exceeds the configured size limit')
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > maxBytes) {
      throw new Error('Eastman document response exceeds the configured size limit')
    }
    return bytes
  }

  cached(key, loader) {
    const cached = this.cache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.promise

    const promise = loader().catch((error) => {
      this.cache.delete(key)
      throw error
    })
    this.cache.set(key, { expiresAt: Date.now() + this.cacheTtlMs, promise })
    return promise
  }

  async fetchTds(product, query, signal) {
    const fullText = await this.cached(`tds:${product.fgmn}`, async () => {
      const response = await this.fetchResponse(product.links.tds, {}, signal)
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.toLowerCase().includes('text/html')) {
        throw new Error('Eastman TDS endpoint did not return HTML')
      }
      const html = await this.readText(response, MAX_HTML_BYTES)
      const text = extractHtmlText(html)
      if (!text) throw new Error('Eastman TDS did not contain readable text')
      return text
    })

    return {
      type: 'tds',
      status: 'available',
      label: 'Technical data sheet',
      text: relevantExcerpt(fullText, query),
      source: documentSource(
        product,
        'tds',
        `${product.displayName} — Technical data sheet`,
      ),
    }
  }

  async fetchSds(product, query, signal) {
    const options = await this.cached(`sds-options:${product.fgmn}`, async () => {
      const listingResponse = await this.fetchResponse(product.links.sds, {}, signal)
      const listingHtml = await this.readText(listingResponse, MAX_HTML_BYTES)
      return parseSdsOptions(listingHtml)
    })
    const option = selectSdsOption(options, query)
    if (!option) throw new Error('No matching English SDS was listed')

    const fullText = await this.cached(
      `sds:${product.fgmn}:${option.requestToken}`,
      async () => {
        const showUrl = new URL(SDS_SHOW_PATH, product.links.sds).toString()
        const body = new URLSearchParams({
          hURL: option.requestToken,
          ProductId: option.productId,
          BT: 'N',
        })
        const pdfResponse = await this.fetchResponse(
          showUrl,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
          },
          signal,
        )
        const contentType = pdfResponse.headers.get('content-type') || ''
        if (!contentType.toLowerCase().includes('application/pdf')) {
          throw new Error('Eastman SDS endpoint did not return a PDF')
        }
        const pdf = await this.readBytes(pdfResponse, MAX_PDF_BYTES)
        const text = normalizeText(await this.pdfTextExtractor(pdf))
        if (!text) throw new Error('Eastman SDS did not contain readable text')
        return text
      },
    )

    return {
      type: 'sds',
      status: 'available',
      label: option.label,
      text: relevantExcerpt(fullText, query),
      source: documentSource(
        product,
        'sds',
        `${product.displayName} — ${option.label}`,
      ),
    }
  }

  async enrichProduct(product, plan, query, signal) {
    const documents = []
    const requests = []

    if (plan.includeTds) {
      if (product.documents.hasTds) {
        requests.push(
          this.fetchTds(product, query, signal)
            .then((document) => documents.push(document))
            .catch((error) => {
              if (signal?.aborted) throw error
              documents.push(unavailableDocument(product, 'tds', classifyDocumentError(error)))
            }),
        )
      } else {
        documents.push(unavailableDocument(product, 'tds', 'not-listed'))
      }
    }

    if (plan.includeSds) {
      if (product.documents.hasSds) {
        requests.push(
          this.fetchSds(product, query, signal)
            .then((document) => documents.push(document))
            .catch((error) => {
              if (signal?.aborted) throw error
              documents.push(unavailableDocument(product, 'sds', classifyDocumentError(error)))
            }),
        )
      } else {
        documents.push(unavailableDocument(product, 'sds', 'not-listed'))
      }
    }

    await Promise.all(requests)
    documents.sort((left, right) => left.type.localeCompare(right.type))
    return documents
  }
}

module.exports = {
  EastmanDocumentClient,
  extractHtmlText,
  parseSdsOptions,
  relevantExcerpt,
  selectSdsOption,
}
