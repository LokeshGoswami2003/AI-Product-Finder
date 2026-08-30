import { useEffect, useState } from 'react'
import { AccessGate } from './components/AccessGate'
import { ChatShell } from './components/ChatShell'

function App() {
  const [authState, setAuthState] = useState('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/auth/session', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((response) => setAuthState(response.ok ? 'authenticated' : 'anonymous'))
      .catch((error) => {
        if (error.name !== 'AbortError') setAuthState('anonymous')
      })
    return () => controller.abort()
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    })
    setAuthState('anonymous')
  }

  if (authState === 'checking') {
    return <main className="loading-page" aria-live="polite">Loading product finder…</main>
  }
  if (authState === 'anonymous') {
    return <AccessGate onAuthenticated={() => setAuthState('authenticated')} />
  }
  return <ChatShell onLogout={logout} />
}

export default App
