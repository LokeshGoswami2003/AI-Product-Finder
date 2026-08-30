import { useReducer, useState } from 'react'
import { ProductCard } from './ProductCard'
import { useChatSocket } from '../hooks/useChatSocket'
import { chatReducer, initialChatState } from '../state/chat'
import { safeEastmanUrl } from '../protocol/links'

const STARTERS = [
  'Find a product for selective H2S removal',
  'Tell me about AdapT 100',
  'Compare AdapT 100 and AdapT 201',
]

export function ChatShell({ onLogout }) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState)
  const [draft, setDraft] = useState('')

  const { status, connect, send } = useChatSocket({
    enabled: true,
    onEvent(event) {
      const requestId = event.requestId
      switch (event.type) {
        case 'chat.accepted':
          dispatch({ type: 'request.accepted' })
          break
        case 'chat.progress':
          dispatch({ type: 'request.progress', stage: event.stage })
          break
        case 'answer.delta':
          dispatch({ type: 'answer.delta', requestId, delta: event.delta })
          break
        case 'answer.sources':
          dispatch({ type: 'answer.sources', requestId, sources: event.sources })
          break
        case 'answer.products':
          dispatch({ type: 'answer.products', requestId, products: event.products })
          break
        case 'answer.done':
          dispatch({ type: 'answer.done' })
          break
        case 'error':
          dispatch({ type: 'request.error', message: event.message })
          break
        default:
          break
      }
    },
  })

  function submit(message = draft) {
    const trimmed = message.trim()
    if (!trimmed || state.activeRequestId || status !== 'connected') return

    const requestId = crypto.randomUUID()
    const history = state.messages
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .slice(-10)
      .map(({ role, content }) => ({ role, content }))
    const sent = send({
      type: 'chat.request',
      requestId,
      message: trimmed,
      history,
      region: null,
    })
    if (!sent) return

    dispatch({ type: 'request.started', requestId, message: trimmed })
    setDraft('')
  }

  function cancel() {
    if (!state.activeRequestId) return
    send({ type: 'chat.cancel', requestId: state.activeRequestId })
    dispatch({ type: 'request.cancelled' })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#main-content" aria-label="AI Product Finder home">
          <span className="brand-mark" aria-hidden="true">E</span>
          <span>AI Product Finder</span>
        </a>
        <div className="header-actions">
          <span className={`connection connection--${status}`}>
            <span aria-hidden="true">●</span> {status}
          </span>
          <button className="secondary-button" type="button" onClick={() => dispatch({ type: 'chat.clear' })}>
            New chat
          </button>
          <button className="text-button" type="button" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <main id="main-content" className="chat-layout">
        <section className="chat-intro">
          <p className="eyebrow">GROUNDED PRODUCT DISCOVERY</p>
          <h1>What can we help you find?</h1>
          <p>
            Explore Eastman products using catalog evidence and links to official resources.
          </p>
          <p className="privacy-banner">
            Conversation stays in this tab and disappears when you refresh or start a new chat.
          </p>
        </section>

        <section className="conversation" aria-label="Product finder conversation">
          {state.messages.length === 0 && (
            <div className="starter-grid">
              {STARTERS.map((prompt) => (
                <button key={prompt} type="button" onClick={() => submit(prompt)} disabled={status !== 'connected'}>
                  <span>{prompt}</span><span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          )}

          <div className="message-list">
            {state.messages.map((message) => (
              <article className={`message message--${message.role}`} key={message.id}>
                <p className="message-role">{message.role === 'user' ? 'You' : 'Product Finder'}</p>
                <p className="message-content">{message.content}</p>
                {message.products?.map((product) => (
                  <ProductCard key={product.fgmn} product={product} />
                ))}
                {message.sources?.length > 0 && (
                  <div className="sources">
                    <h3>Official sources</h3>
                    <ul>
                      {message.sources.map((source) => {
                        const url = safeEastmanUrl(source.url)
                        return url ? (
                          <li key={source.id}>
                            <a href={url} target="_blank" rel="noreferrer">{source.title}</a>
                          </li>
                        ) : null
                      })}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="status-region" role="status" aria-live="polite">
            {state.progress || (status === 'connected' ? '' : `Connection ${status}.`)}
          </div>
          {state.error && <p className="chat-error" role="alert">{state.error}</p>}
          {status === 'disconnected' && (
            <button className="secondary-button retry-button" type="button" onClick={connect}>Reconnect</button>
          )}
        </section>

        <form className="composer" onSubmit={(event) => { event.preventDefault(); submit() }}>
          <label className="sr-only" htmlFor="chat-message">Ask about an Eastman product</label>
          <textarea
            id="chat-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            placeholder="Describe your application, requirement, or product…"
            maxLength={4000}
            rows={3}
          />
          <div className="composer-footer">
            <span>{draft.length}/4000</span>
            {state.activeRequestId ? (
              <button className="cancel-button" type="button" onClick={cancel}>Cancel</button>
            ) : (
              <button className="primary-button" type="submit" disabled={!draft.trim() || status !== 'connected'}>
                Send
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}

