const { normalizeLookupText } = require('./text')

class ExactResolver {
  constructor(products) {
    this.productsByFgmn = new Map()
    this.productsByName = new Map()

    for (const product of products) {
      this.productsByFgmn.set(product.fgmn.toLowerCase(), product)

      for (const name of [product.displayName, product.sortName, ...(product.aliases || [])]) {
        const normalized = normalizeLookupText(name)
        if (!this.productsByName.has(normalized)) {
          this.productsByName.set(normalized, [])
        }
        const matches = this.productsByName.get(normalized)
        if (!matches.some((match) => match.fgmn === product.fgmn)) {
          matches.push(product)
        }
      }
    }
  }

  resolve(value) {
    const input = value.trim()
    const byFgmn = this.productsByFgmn.get(input.toLowerCase())
    if (byFgmn) {
      return { type: 'fgmn', products: [byFgmn] }
    }

    const products = this.productsByName.get(normalizeLookupText(input)) || []
    if (products.length === 1) {
      return { type: 'name', products }
    }
    if (products.length > 1) {
      return { type: 'ambiguous', products }
    }
    return null
  }

  resolveInText(value) {
    const normalizedInput = ` ${normalizeLookupText(value)} `
    const matches = new Map()

    for (const [fgmn, product] of this.productsByFgmn) {
      if (new RegExp(`(?:^|\\s)${fgmn}(?:\\s|$)`).test(normalizedInput)) {
        matches.set(product.fgmn, product)
      }
    }
    for (const [name, products] of this.productsByName) {
      if (name.length >= 4 && normalizedInput.includes(` ${name} `)) {
        for (const product of products) matches.set(product.fgmn, product)
      }
    }

    if (matches.size === 1) {
      return { type: 'mention', products: [...matches.values()] }
    }
    if (matches.size > 1) {
      return { type: 'ambiguous', products: [...matches.values()] }
    }
    return null
  }
}

module.exports = { ExactResolver }
