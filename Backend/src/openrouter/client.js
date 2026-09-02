class OpenRouterError extends Error {
  constructor(message, { status = null, code = null, retryable = false } = {}) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function isRetryableStatus(status) {
  return (
    status === 401 ||
    status === 402 ||
    status === 403 ||
    status === 404 ||
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500
  );
}

class OpenRouterClient {
  constructor({
    apiKey,
    model = "z-ai/glm-5.2:free",
    baseUrl = "https://openrouter.ai/api/v1",
    siteUrl,
    appName = "AI Product Finder",
    fetchImpl = fetch,
  }) {
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      throw new TypeError("An OpenRouter API key is required");
    }

    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.siteUrl = siteUrl;
    this.appName = appName;
    this.fetchImpl = fetchImpl;
  }

  buildHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...(this.siteUrl ? { "HTTP-Referer": this.siteUrl } : {}),
      ...(this.appName ? { "X-Title": this.appName } : {}),
    };
  }

  buildPayload({
    messages,
    responseFormat,
    tools,
    toolChoice,
    maxTokens,
    stream = false,
  }) {
    return {
      model: this.model,
      messages,
      ...(stream
        ? { stream: true, stream_options: { include_usage: true } }
        : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
      ...(tools ? { tools } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    };
  }

  async request(payload, signal) {
    try {
      return await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
        signal,
      });
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw error;
      throw new OpenRouterError("OpenRouter could not be reached", {
        code: error?.code || null,
        retryable: true,
      });
    }
  }

  async responseError(response) {
    const body = await response.json().catch(() => null);
    return new OpenRouterError(
      body?.error?.message ||
        `OpenRouter request failed with status ${response.status}`,
      {
        status: response.status,
        code: body?.error?.code || null,
        retryable: isRetryableStatus(response.status),
      },
    );
  }

  async createChatCompletion({
    messages,
    signal,
    responseFormat,
    tools,
    toolChoice,
    maxTokens,
  }) {
    const response = await this.request(
      this.buildPayload({
        messages,
        responseFormat,
        tools,
        toolChoice,
        maxTokens,
      }),
      signal,
    );

    if (!response.ok) throw await this.responseError(response);
    let completion;
    try {
      completion = await response.json();
    } catch {
      throw new OpenRouterError("OpenRouter returned malformed JSON", {
        status: response.status,
        retryable: true,
      });
    }
    if (typeof completion?.choices?.[0]?.message?.content !== "string") {
      throw new OpenRouterError("OpenRouter returned no answer", {
        status: response.status,
        code: completion?.error?.code || null,
        retryable: true,
      });
    }
    return completion;
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
    const response = await this.request(
      this.buildPayload({
        messages,
        responseFormat,
        tools,
        toolChoice,
        maxTokens,
        stream: true,
      }),
      signal,
    );

    if (!response.ok) throw await this.responseError(response);
    if (!response.body) {
      throw new OpenRouterError(
        "The OpenRouter streaming response had no body",
        {
          status: response.status,
          retryable: true,
        },
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let usage = null;
    let model = null;

    const consumeEvent = (event) => {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data || data === "[DONE]") return;

      const payload = JSON.parse(data);
      if (payload.error) {
        throw new OpenRouterError(
          payload.error.message || "OpenRouter reported a streaming failure",
          {
            code: payload.error.code || null,
            retryable: true,
          },
        );
      }
      const delta = payload.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        text += delta;
        onDelta(delta);
      }
      if (payload.usage) usage = payload.usage;
      if (payload.model) model = payload.model;
    };

    try {
      for await (const chunk of response.body) {
        buffer += decoder
          .decode(chunk, { stream: true })
          .replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          consumeEvent(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeEvent(buffer);
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw error;
      if (error instanceof OpenRouterError) throw error;
      throw new OpenRouterError("The OpenRouter stream ended unexpectedly", {
        code: error?.code || null,
        retryable: true,
      });
    }

    if (text.trim() === "") {
      throw new OpenRouterError("OpenRouter returned an empty stream", {
        status: response.status,
        retryable: true,
      });
    }

    return {
      choices: [{ message: { content: text } }],
      usage,
      ...(model ? { model } : {}),
    };
  }
}

module.exports = { OpenRouterClient, OpenRouterError, isRetryableStatus };
