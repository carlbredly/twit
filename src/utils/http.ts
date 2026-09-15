import { isAbortError, validatePublicHttpUrl } from './security';

export const FETCH_TIMEOUT_MS = 15_000;

export interface FetchValidatedOptions {
  httpsOnly?: boolean;
  timeoutMs?: number;
}

function combineSignals(signals: Array<AbortSignal | undefined>): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();

  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }

  return controller.signal;
}

export async function fetchValidated(
  url: string,
  init: RequestInit = {},
  options: FetchValidatedOptions = {}
): Promise<Response | null> {
  const check = validatePublicHttpUrl(url, { httpsOnly: options.httpsOnly ?? true });
  if (!check.ok) return null;

  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = combineSignals([init.signal ?? undefined, timeout]);

  try {
    return await fetch(check.url.href, {
      ...init,
      redirect: init.redirect ?? 'follow',
      signal,
    });
  } catch (error) {
    if (isAbortError(error) && init.signal?.aborted) {
      throw error;
    }
    return null;
  }
}

export async function fetchJson(
  url: string,
  init: RequestInit = {},
  options: FetchValidatedOptions = {}
): Promise<unknown | null> {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const response = await fetchValidated(url, { ...init, headers }, options);
  if (!response?.ok) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
}
