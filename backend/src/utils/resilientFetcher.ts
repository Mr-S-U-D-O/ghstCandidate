import axios, { AxiosRequestConfig } from 'axios';

// ── User-Agent Pool ───────────────────────────────────────────────────────────
// Rotates on each request to reduce risk of IP-level fingerprinting.

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ── Jitter Backoff ────────────────────────────────────────────────────────────

function jitterDelay(attempt: number): number {
  // Exponential backoff: 2^attempt * 1000ms + 0–1000ms random jitter
  return Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface ResilientFetchOptions {
  /** Max request timeout in ms. Default: 5000 */
  timeoutMs?: number;
  /** Max retry attempts on 429/503/529. Default: 3 */
  maxRetries?: number;
  /** Additional axios config to merge in */
  axiosConfig?: AxiosRequestConfig;
}

// ── Core Fetcher ──────────────────────────────────────────────────────────────

/**
 * Fetches raw HTML (or text) from a URL with:
 * - Randomized User-Agent rotation
 * - 5000ms default timeout
 * - Exponential backoff with randomized jitter on 429/503/529
 *
 * Throws after `maxRetries` are exhausted.
 */
export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {}
): Promise<string> {
  const { timeoutMs = 5000, maxRetries = 3, axiosConfig = {} } = options;

  let lastError: Error = new Error('resilientFetch: no attempts made');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get<string>(url, {
        timeout: timeoutMs,
        responseType: 'text',
        headers: {
          'User-Agent': randomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          ...axiosConfig.headers,
        },
        ...axiosConfig,
      });

      return response.data;
    } catch (err: any) {
      lastError = err;

      const status: number = err?.response?.status ?? 0;
      const isRateLimited = status === 429 || status === 503 || status === 529;
      const isTimeout = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';

      if ((isRateLimited || isTimeout) && attempt < maxRetries) {
        const delay = jitterDelay(attempt + 1);
        console.warn(
          `[resilientFetch] ⚠️ HTTP ${status || err.code} on "${url}". ` +
          `Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable error — break immediately
      break;
    }
  }

  throw lastError;
}
