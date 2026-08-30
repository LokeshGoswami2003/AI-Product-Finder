import { useCallback, useEffect, useRef, useState } from 'react'

function socketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/chat`
}

export function useChatSocket({ enabled, onEvent }) {
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const connectRef = useRef(null)
  const attemptsRef = useRef(0)
  const shouldReconnectRef = useRef(false)
  const onEventRef = useRef(onEvent)
  const [status, setStatus] = useState('disconnected')

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const connect = useCallback(() => {
    if (!enabled || socketRef.current?.readyState === WebSocket.OPEN) return

    window.clearTimeout(reconnectTimerRef.current)
    setStatus(attemptsRef.current === 0 ? 'connecting' : 'reconnecting')
    const socket = new WebSocket(socketUrl())
    socketRef.current = socket

    socket.addEventListener('open', () => {
      attemptsRef.current = 0
      setStatus('connected')
    })
    socket.addEventListener('message', (event) => {
      try {
        onEventRef.current(JSON.parse(event.data))
      } catch {
        onEventRef.current({
          type: 'error',
          message: 'The server returned an unreadable response.',
        })
      }
    })
    socket.addEventListener('close', () => {
      if (socketRef.current !== socket) return
      socketRef.current = null
      setStatus('disconnected')
      if (shouldReconnectRef.current) {
        const delay = Math.min(1_000 * 2 ** attemptsRef.current, 10_000)
        attemptsRef.current += 1
        reconnectTimerRef.current = window.setTimeout(() => connectRef.current?.(), delay)
      }
    })
  }, [enabled])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    shouldReconnectRef.current = enabled
    if (enabled) connect()
    return () => {
      shouldReconnectRef.current = false
      window.clearTimeout(reconnectTimerRef.current)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [connect, enabled])

  const send = useCallback((event) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return false
    socketRef.current.send(JSON.stringify(event))
    return true
  }, [])

  return { status, connect, send }
}
