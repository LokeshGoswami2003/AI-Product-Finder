function abortError(signal) {
  return (
    signal?.reason ||
    new DOMException("The operation was aborted", "AbortError")
  );
}

function sleep(ms, signal) {
  if (signal?.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

class SlidingWindowRateLimiter {
  constructor({
    requestsPerMinute,
    tokensPerMinute,
    windowMs = 60000,
    now = Date.now,
    sleepImpl = sleep,
    onWait = () => {},
  }) {
    if (!Number.isInteger(requestsPerMinute) || requestsPerMinute < 1) {
      throw new TypeError("requestsPerMinute must be a positive integer");
    }
    if (!Number.isInteger(tokensPerMinute) || tokensPerMinute < 1) {
      throw new TypeError("tokensPerMinute must be a positive integer");
    }
    this.requestsPerMinute = requestsPerMinute;
    this.tokensPerMinute = tokensPerMinute;
    this.windowMs = windowMs;
    this.minimumRequestIntervalMs = Math.ceil(windowMs / requestsPerMinute);
    this.now = now;
    this.sleep = sleepImpl;
    this.onWait = onWait;
    this.reservations = [];
    this.tail = Promise.resolve();
  }

  prune(currentTime) {
    const cutoff = currentTime - this.windowMs;
    this.reservations = this.reservations.filter(
      (reservation) => reservation.at > cutoff,
    );
  }

  tokenWait(tokenCount, currentTime) {
    let used = this.reservations.reduce(
      (total, reservation) => total + reservation.tokens,
      0,
    );
    if (used + tokenCount <= this.tokensPerMinute) return 0;
    for (const reservation of this.reservations) {
      used -= reservation.tokens;
      if (used + tokenCount <= this.tokensPerMinute) {
        return Math.max(1, reservation.at + this.windowMs - currentTime);
      }
    }
    return this.windowMs;
  }

  async acquireLocked(tokenCount, signal) {
    if (!Number.isInteger(tokenCount) || tokenCount < 1) {
      throw new TypeError("tokenCount must be a positive integer");
    }
    if (tokenCount > this.tokensPerMinute) {
      throw new RangeError(
        `A ${tokenCount}-token request exceeds the ${this.tokensPerMinute} TPM limit`,
      );
    }

    while (true) {
      if (signal?.aborted) throw abortError(signal);
      const currentTime = this.now();
      this.prune(currentTime);
      const requestWait =
        this.reservations.length >= this.requestsPerMinute
          ? Math.max(1, this.reservations[0].at + this.windowMs - currentTime)
          : 0;
      const latestReservation = this.reservations.at(-1);
      const pacingWait = latestReservation
        ? Math.max(
            0,
            latestReservation.at + this.minimumRequestIntervalMs - currentTime,
          )
        : 0;
      const tokenWait = this.tokenWait(tokenCount, currentTime);
      const waitMs = Math.max(requestWait, pacingWait, tokenWait);
      if (waitMs === 0) {
        this.reservations.push({ at: currentTime, tokens: tokenCount });
        return;
      }
      this.onWait({ waitMs, tokenCount });
      await this.sleep(waitMs, signal);
    }
  }

  acquire(tokenCount, signal) {
    const acquisition = this.tail.then(() =>
      this.acquireLocked(tokenCount, signal),
    );
    this.tail = acquisition.catch(() => {});
    return acquisition;
  }
}

module.exports = { SlidingWindowRateLimiter, sleep };
