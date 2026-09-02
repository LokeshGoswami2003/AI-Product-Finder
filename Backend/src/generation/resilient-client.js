function isCancellation(error, signal) {
  return (
    signal?.aborted === true ||
    error?.name === "AbortError" ||
    error?.code === "ABORT_ERR"
  );
}

function canFailOver(error, signal) {
  return !isCancellation(error, signal) && error?.retryable === true;
}

class ResilientGenerationClient {
  constructor({ clients }) {
    if (!Array.isArray(clients) || clients.length === 0) {
      throw new TypeError("At least one generation client is required");
    }
    if (
      clients.some(
        (client) =>
          !client?.createChatCompletion || !client?.createChatCompletionStream,
      )
    ) {
      throw new TypeError(
        "Every generation client must support completion and streaming",
      );
    }

    this.clients = [...clients];
  }

  async createChatCompletion(options) {
    for (let index = 0; index < this.clients.length; index += 1) {
      try {
        return await this.clients[index].createChatCompletion(options);
      } catch (error) {
        const hasFallback = index < this.clients.length - 1;
        if (!hasFallback || !canFailOver(error, options.signal)) throw error;
      }
    }

    throw new Error("No generation client was available");
  }

  async createChatCompletionStream(options) {
    let outputStarted = false;
    const onDelta = options.onDelta || (() => {});

    for (let index = 0; index < this.clients.length; index += 1) {
      try {
        return await this.clients[index].createChatCompletionStream({
          ...options,
          onDelta(delta) {
            outputStarted = true;
            onDelta(delta);
          },
        });
      } catch (error) {
        const hasFallback = index < this.clients.length - 1;
        if (
          outputStarted ||
          !hasFallback ||
          !canFailOver(error, options.signal)
        ) {
          throw error;
        }
      }
    }

    throw new Error("No generation client was available");
  }
}

module.exports = {
  canFailOver,
  isCancellation,
  ResilientGenerationClient,
};
