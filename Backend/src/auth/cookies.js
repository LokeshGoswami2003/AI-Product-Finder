const cookie = require('cookie')

function sessionCookieOptions(config) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.NODE_ENV === 'production',
    path: '/',
    maxAge: config.AUTH_TTL_SECONDS,
  }
}

function serializeSessionCookie(config, token) {
  return cookie.serialize(config.AUTH_COOKIE_NAME, token, sessionCookieOptions(config))
}

function clearSessionCookie(config) {
  return cookie.serialize(config.AUTH_COOKIE_NAME, '', {
    ...sessionCookieOptions(config),
    maxAge: 0,
    expires: new Date(0),
  })
}

function readSessionCookie(config, cookieHeader) {
  if (!cookieHeader) return null
  return cookie.parse(cookieHeader)[config.AUTH_COOKIE_NAME] || null
}

module.exports = {
  clearSessionCookie,
  readSessionCookie,
  serializeSessionCookie,
  sessionCookieOptions,
}

