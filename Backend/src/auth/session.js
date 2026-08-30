const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto')

const TOKEN_VERSION = 1

function sign(encodedPayload, secret) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

function createSessionToken({ secret, ttlSeconds, now = Date.now() }) {
  const payload = {
    v: TOKEN_VERSION,
    exp: Math.floor(now / 1000) + ttlSeconds,
    nonce: randomBytes(16).toString('base64url'),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${sign(encodedPayload, secret)}`
}

function verifySessionToken(token, { secret, now = Date.now() }) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [encodedPayload, suppliedSignature] = parts
  const expectedSignature = sign(encodedPayload, secret)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null
  }

  let payload
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (
    payload.v !== TOKEN_VERSION ||
    !Number.isInteger(payload.exp) ||
    typeof payload.nonce !== 'string' ||
    payload.exp <= Math.floor(now / 1000)
  ) {
    return null
  }

  return payload
}

function constantTimeAccessCodeMatch(suppliedCode, expectedCode) {
  const key = randomBytes(32)
  const suppliedDigest = createHmac('sha256', key)
    .update(typeof suppliedCode === 'string' ? suppliedCode : '')
    .digest()
  const expectedDigest = createHmac('sha256', key).update(expectedCode).digest()
  return timingSafeEqual(suppliedDigest, expectedDigest)
}

module.exports = {
  constantTimeAccessCodeMatch,
  createSessionToken,
  verifySessionToken,
}

