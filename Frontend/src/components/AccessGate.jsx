import { useState } from 'react'
import { EastmanPageMock } from './EastmanPageMock'

export function AccessGate({ onAuthenticated }) {
  const [accessCode, setAccessCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode }),
      })
      if (!response.ok) {
        setError(
          response.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : 'The access code was not accepted.',
        )
        return
      }
      setAccessCode('')
      onAuthenticated()
    } catch {
      setError('The service is unavailable. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="preview-page">
      <EastmanPageMock />
      <div className="site-veil" />
      <aside className="chat-widget access-widget" aria-labelledby="access-title">
        <header className="widget-header">
          <div className="assistant-identity">
            <span className="assistant-mark" aria-hidden="true">✦</span>
            <div>
              <strong>Product finder</strong>
              <span>Eastman assistant preview</span>
            </div>
          </div>
        </header>

        <div className="access-content">
          <p className="widget-kicker">MVP PREVIEW</p>
          <h1 id="access-title">Find the right product, faster.</h1>
          <p className="access-intro">
            Enter the preview access code to search products and supporting Eastman resources.
          </p>

          <form onSubmit={submit}>
            <label htmlFor="access-code">Access code</label>
            <div className="password-field">
              <input
                id="access-code"
                type={showCode ? 'text' : 'password'}
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                autoComplete="current-password"
                required
                autoFocus
              />
              <button
                className="text-button"
                type="button"
                onClick={() => setShowCode((visible) => !visible)}
                aria-label={showCode ? 'Hide access code' : 'Show access code'}
              >
                {showCode ? 'Hide' : 'Show'}
              </button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Checking…' : 'Open product finder'}
            </button>
          </form>
          <p className="privacy-note">The code is used only to unlock this preview.</p>
        </div>
      </aside>
    </main>
  )
}
