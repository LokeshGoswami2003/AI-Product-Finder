class OpenRouterError extends Error {
  constructor(message, { status, code, retryable }) {
    super(message)
    this.name = 'OpenRouterError'
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

class OpenRouterClient {
  constructor({
    apiKeys,
    model = 'openrouter/free',
    baseUrl = 'https://openrouter.ai/api/v1',
    appName = 'AI Product Finder',
    siteUrl,
    fetchImpl = fetch,
  }) {
    if (!Array.isArray(apiKeys) || apiKeys.length === 0) {
      throw new TypeError('At least one OpenRouter API key is required')
    }

    this.apiKeys = [...apiKeys]
    this.model = model
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.appName = appName
    this.siteUrl = siteUrl
    this.fetchImpl = fetchImpl
  }

  async createChatCompletion({ messages, signal, responseFormat }) {
    let lastError

    for (const apiKey of this.apiKeys) {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': this.appName,
          ...(this.siteUrl ? { 'HTTP-Referer': this.siteUrl } : {}),
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

      const retryableWithAnotherKey = [401, 402, 429].includes(response.status)
      const body = await response.json().catch(() => null)
      lastError = new OpenRouterError(
        body?.error?.message || `OpenRouter request failed with status ${response.status}`,
        {
          status: response.status,
          code: body?.error?.code || null,
          retryable: retryableWithAnotherKey || response.status >= 500,
        },
      )

      if (!retryableWithAnotherKey) {
        throw lastError
      }
    }

    throw lastError
  }
}

module.exports = { OpenRouterClient, OpenRouterError }

