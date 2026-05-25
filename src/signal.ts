export interface RequestSignalOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ResolvedRequestSignal {
  signal?: AbortSignal;
  cleanup: () => void;
}

export function resolveRequestSignal(options: RequestSignalOptions = {}): ResolvedRequestSignal {
  assertValidTimeout(options.timeoutMs);

  if (options.timeoutMs === undefined) {
    return {
      signal: options.signal,
      cleanup: noop,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new DOMException(`Mouser request timed out after ${options.timeoutMs}ms.`, "TimeoutError"),
    );
  }, options.timeoutMs);

  const abortFromCaller = (): void => {
    controller.abort(options.signal?.reason);
  };

  if (options.signal?.aborted) {
    abortFromCaller();
  } else {
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

function assertValidTimeout(timeoutMs: number | undefined): void {
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs < 0)) {
    throw new RangeError("timeoutMs must be a non-negative finite number.");
  }
}

function noop(): void {}
