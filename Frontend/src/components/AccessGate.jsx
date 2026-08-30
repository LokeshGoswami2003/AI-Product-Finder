import { useState } from 'react'

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
    <main className="access-page">
      <section className="access-card" aria-labelledby="access-title">
        <div className="brand-mark" aria-hidden="true">E</div>
        <p className="eyebrow">AI PRODUCT FINDER</p>
        <h1 id="access-title">Find the right Eastman product</h1>
        <p className="access-intro">
          Search product evidence, compare grades, and reach official technical resources.
        </p>

        <form onSubmit={submit}>
          <label htmlFor="access-code">MVP access code</label>
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
            {submitting ? 'Checking…' : 'Continue'}
          </button>
        </form>
        <p className="privacy-note">Your access code is never stored in this browser.</p>
      </section>
    </main>
  )
}

