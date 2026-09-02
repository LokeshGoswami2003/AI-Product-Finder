class VercelAIGatewayError extends Error {
  constructor(message, { status, code, retryable }) {
    super(message);
    this.name = "VercelAIGatewayError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

class VercelAIGatewayClient {
  constructor({
    apiKey,
    model = "zai/glm-5.3-flash",
    baseUrl = "https://ai-gateway.vercel.sh/v1",
    fetchImpl = fetch,
  }) {
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      throw new TypeError("A Vercel AI Gateway API key is required");
    }

    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
  }

  async createChatCompletion({
    messages,
    signal,
    responseFormat,
    tools,
    toolChoice,
    maxTokens,
  }) {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        ...(responseFormat ? { response_format: responseFormat } : {}),
        ...(tools ? { tools } : {}),
        ...(toolChoice ? { tool_choice: toolChoice } : {}),
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
      signal,
    });

    if (response.ok) {
      return response.json();
    }

    const body = await response.json().catch(() => null);
    throw new VercelAIGatewayError(
      body?.error?.message ||
        `Vercel AI Gateway request failed with status ${response.status}`,
      {
        status: response.status,
        code: body?.error?.code || null,
        retryable: response.status === 429 || response.status >= 500,
      },
    );
  }

  async createChatCompletionStream({
    messages,
    signal,
    responseFormat,
    tools,
    toolChoice,
    maxTokens,
    onDelta = () => {},
  }) {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(responseFormat ? { response_format: responseFormat } : {}),
        ...(tools ? { tools } : {}),
        ...(toolChoice ? { tool_choice: toolChoice } : {}),
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
      signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new VercelAIGatewayError(
        body?.error?.message ||
          `Vercel AI Gateway request failed with status ${response.status}`,
        {
          status: response.status,
          code: body?.error?.code || null,
          retryable: response.status === 429 || response.status >= 500,
        },
      );
    }
    if (!response.body) {
      throw new VercelAIGatewayError("The streaming response had no body", {
        status: response.status,
        code: null,
        retryable: true,
      });
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let usage = null;

    const consumeEvent = (event) => {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data || data === "[DONE]") return;

      const payload = JSON.parse(data);
      const delta = payload.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        text += delta;
        onDelta(delta);
      }
      if (payload.usage) usage = payload.usage;
    };

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        consumeEvent(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) consumeEvent(buffer);

    return {
      choices: [{ message: { content: text } }],
      usage,
    };
  }
}

module.exports = { VercelAIGatewayClient, VercelAIGatewayError };
