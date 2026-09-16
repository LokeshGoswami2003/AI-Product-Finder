import { useCallback, useEffect, useRef } from "react";

export const ANSWER_INITIAL_DELAY_MS = 850;
export const ANSWER_CHUNK_DELAY_MS = 65;
const TARGET_CHUNK_LENGTH = 10;

export function answerChunkDelay(chunk = "") {
  if (/[.!?]\s*$/.test(chunk)) return 150;
  if (/[,;:]\s*$/.test(chunk)) return 95;
  return ANSWER_CHUNK_DELAY_MS;
}

export function chunkAnswerText(text) {
  const parts = String(text || "").match(/\S+\s*/g) || [];
  const chunks = [];
  let current = "";
  for (const part of parts) {
    current += part;
    if (current.length >= TARGET_CHUNK_LENGTH) {
      chunks.push(current);
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function useAnswerAnimator(dispatch) {
  const stateRef = useRef(null);

  const reset = useCallback(() => {
    if (stateRef.current?.timer) {
      window.clearTimeout(stateRef.current.timer);
    }
    stateRef.current = null;
  }, []);

  const finish = useCallback(() => {
    const animation = stateRef.current;
    if (!animation?.done) return;
    if (animation.sources) {
      dispatch({
        type: "answer.sources",
        requestId: animation.requestId,
        sources: animation.sources,
      });
    }
    if (animation.products) {
      dispatch({
        type: "answer.products",
        requestId: animation.requestId,
        products: animation.products,
      });
    }
    dispatch({ type: "answer.done", quota: animation.done.quota });
    stateRef.current = null;
  }, [dispatch]);

  const schedule = useCallback(
    function scheduleNext(delay = ANSWER_CHUNK_DELAY_MS) {
      const animation = stateRef.current;
      if (!animation || animation.timer) return;
      animation.timer = window.setTimeout(() => {
        const current = stateRef.current;
        if (!current) return;
        current.timer = null;
        const chunk = current.chunks.shift();
        if (chunk) {
          dispatch({
            type: "answer.delta",
            requestId: current.requestId,
            delta: chunk,
          });
          scheduleNext(answerChunkDelay(chunk));
        } else {
          finish();
        }
      }, delay);
    },
    [dispatch, finish],
  );

  const ensure = useCallback(
    (requestId) => {
      if (stateRef.current?.requestId !== requestId) {
        reset();
        stateRef.current = {
          requestId,
          chunks: [],
          timer: null,
          sources: null,
          products: null,
          done: null,
          started: false,
        };
      }
      return stateRef.current;
    },
    [reset],
  );

  const enqueue = useCallback(
    (requestId, text) => {
      const animation = ensure(requestId);
      animation.chunks.push(...chunkAnswerText(text));
      if (!animation.started) {
        animation.started = true;
        dispatch({ type: "request.progress", stage: "composing" });
        schedule(ANSWER_INITIAL_DELAY_MS);
      } else {
        schedule();
      }
    },
    [dispatch, ensure, schedule],
  );

  const setSources = useCallback(
    (requestId, sources) => {
      ensure(requestId).sources = sources;
    },
    [ensure],
  );

  const setProducts = useCallback(
    (requestId, products) => {
      ensure(requestId).products = products;
    },
    [ensure],
  );

  const complete = useCallback(
    (requestId, event) => {
      const animation = ensure(requestId);
      animation.done = event;
      schedule(
        animation.started ? ANSWER_CHUNK_DELAY_MS : ANSWER_INITIAL_DELAY_MS,
      );
    },
    [ensure, schedule],
  );

  useEffect(() => reset, [reset]);

  return { complete, enqueue, reset, setProducts, setSources };
}
