function normalizeLookupText(value) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/™|®|©/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

module.exports = { normalizeLookupText }

