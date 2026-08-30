function assertFiniteVector(vector, dimensions, name) {
  if (!Array.isArray(vector) || vector.length !== dimensions) {
    throw new TypeError(`${name} must contain exactly ${dimensions} dimensions`)
  }
  if (!vector.every(Number.isFinite)) {
    throw new TypeError(`${name} must contain only finite numbers`)
  }
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (magnitude === 0) {
    throw new TypeError('Vector magnitude must be greater than zero')
  }
  return vector.map((value) => value / magnitude)
}

class VectorSearch {
  constructor(entries, dimensions) {
    this.dimensions = dimensions
    this.entries = entries.map((entry) => {
      assertFiniteVector(entry.vector, dimensions, `Vector for ${entry.fgmn}`)
      return { ...entry, vector: normalizeVector(entry.vector) }
    })
  }

  search(queryVector, limit = 25) {
    assertFiniteVector(queryVector, this.dimensions, 'Query vector')
    const normalizedQuery = normalizeVector(queryVector)

    return this.entries
      .map((entry) => ({
        fgmn: entry.fgmn,
        chunkId: entry.chunkId,
        score: entry.vector.reduce(
          (sum, value, index) => sum + value * normalizedQuery[index],
          0,
        ),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((result, index) => ({ ...result, rank: index + 1 }))
  }
}

module.exports = { VectorSearch, assertFiniteVector, normalizeVector }

