const express = require('express')
const helmet = require('helmet')

const { createAuthRouter } = require('./http/auth-router')

function createApp({ config, readiness }) {
  const app = express()
  app.disable('x-powered-by')
  if (config.NODE_ENV === 'production') {
    app.set('trust proxy', 'loopback')
  }
  app.use(helmet())
  app.use(express.json({ limit: config.WS_MAX_PAYLOAD_BYTES }))

  app.get('/api/health/live', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.get('/api/health/ready', (_request, response) => {
    const state = readiness()
    response.status(state.ready ? 200 : 503).json(state)
  })

  app.use('/api/auth', createAuthRouter(config))

  app.use((_request, response) => {
    response.status(404).json({ error: 'Not found' })
  })

  return app
}

module.exports = { createApp }
