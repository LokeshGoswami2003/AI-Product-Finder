function reciprocalRankFusion(rankings, { k = 60, limit = 10 } = {}) {
  if (!Number.isFinite(k) || k < 0) {
    throw new TypeError('RRF k must be a nonnegative number')
  }

  const scores = new Map()
  rankings.forEach((ranking) => {
    const seen = new Set()
    ranking.forEach((result, index) => {
      if (seen.has(result.fgmn)) return
      seen.add(result.fgmn)
      scores.set(result.fgmn, (scores.get(result.fgmn) || 0) + 1 / (k + index + 1))
    })
  })

  return [...scores.entries()]
    .map(([fgmn, score]) => ({ fgmn, score }))
    .sort((left, right) => right.score - left.score || left.fgmn.localeCompare(right.fgmn))
    .slice(0, limit)
}

module.exports = { reciprocalRankFusion }

