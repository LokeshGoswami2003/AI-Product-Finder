const REGION_PATTERNS = [
  { id: '1', name: 'Asia Pacific', pattern: /\b(?:asia pacific|apac|apr)\b/i },
  {
    id: '2',
    name: 'Europe, Middle East & Africa',
    pattern: /\b(?:europe,? middle east (?:and|&) africa|emea)\b/i,
  },
  {
    id: '3',
    name: 'North America',
    pattern: /\b(?:north america|nar|united states|canada)\b/i,
  },
  { id: '4', name: 'Latin America', pattern: /\b(?:latin america|latam|lar)\b/i },
]

function resolveExplicitRegion(query) {
  const matches = REGION_PATTERNS.filter((region) => region.pattern.test(query))
  return matches.length === 1 ? { id: matches[0].id, name: matches[0].name } : null
}

module.exports = { REGION_PATTERNS, resolveExplicitRegion }

