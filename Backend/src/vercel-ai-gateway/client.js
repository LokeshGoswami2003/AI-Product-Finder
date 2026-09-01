class VercelAIGatewayError extends Error {
  constructor(message, { status, code, retryable }) {
    super(message)
    this.name = 'VercelAIGatewayError'
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

class VercelAIGatewayClient {
  constructor({
    apiKey,
    model = 'zai/glm-5.3-flash',
    baseUrl = 'https://ai-gateway.vercel.sh/v1',
    fetchImpl = fetch,
  }) {
    if (typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new TypeError('A Vercel AI Gateway API key is required')
    }

    this.apiKey = apiKey
    this.model = model
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.fetchImpl = fetchImpl
  }

  async createChatCompletion({ messages, signal, responseFormat }) {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
      signal,
    })

    if (response.ok) {
      return response.json()
    }

    const body = await response.json().catch(() => null)
    throw new VercelAIGatewayError(
      body?.error?.message || `Vercel AI Gateway request failed with status ${response.status}`,
      {
        status: response.status,
        code: body?.error?.code || null,
        retryable: response.status === 429 || response.status >= 500,
      },
    )
  }
}

module.exports = { VercelAIGatewayClient, VercelAIGatewayError }
