const express = require('express')
const rateLimit = require('express-rate-limit')
const { z } = require('zod')

const {
  constantTimeAccessCodeMatch,
  createSessionToken,
  verifySessionToken,
} = require('../auth/session')
const {
  clearSessionCookie,
  readSessionCookie,
  serializeSessionCookie,
} = require('../auth/cookies')

const loginSchema = z.object({ accessCode: z.string() }).strict()

function hasAllowedOrigin(request, config) {
  return request.get('origin') === config.APP_ORIGIN
}

function createAuthRouter(config) {
  const router = express.Router()
  const loginLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  })

  router.get('/session', (request, response) => {
    const token = readSessionCookie(config, request.get('cookie'))
    const session = verifySessionToken(token, { secret: config.COOKIE_SIGNING_SECRET })
    response.status(session ? 200 : 401).json({ authenticated: Boolean(session) })
  })

  router.post('/login', loginLimiter, (request, response) => {
    if (!hasAllowedOrigin(request, config)) {
      return response.status(403).json({ error: 'Authentication failed' })
    }

    const parsed = loginSchema.safeParse(request.body)
    if (
      !parsed.success ||
      !constantTimeAccessCodeMatch(parsed.data.accessCode, config.MVP_ACCESS_CODE)
    ) {
      return response.status(401).json({ error: 'Authentication failed' })
    }

    const token = createSessionToken({
      secret: config.COOKIE_SIGNING_SECRET,
      ttlSeconds: config.AUTH_TTL_SECONDS,
    })
    response.set('Set-Cookie', serializeSessionCookie(config, token))
    return response.status(204).end()
  })

  router.post('/logout', (request, response) => {
    if (!hasAllowedOrigin(request, config)) {
      return response.status(403).json({ error: 'Authentication failed' })
    }
    response.set('Set-Cookie', clearSessionCookie(config))
    return response.status(204).end()
  })

  return router
}

module.exports = { createAuthRouter, hasAllowedOrigin }

