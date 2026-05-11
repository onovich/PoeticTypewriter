function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

async function parseResponse(response) {
  const data = await response.json().catch(() => null);

  if (response.ok) {
    return data;
  }

  const message = data?.error?.message ?? `Request failed with status ${response.status}`;
  const error = new Error(message);
  error.code = data?.error?.code ?? 'request_failed';
  error.status = response.status;
  error.payload = data;
  throw error;
}

export class CompetitionClient {
  constructor(options = {}) {
    this.baseUrl = trimTrailingSlash(options.baseUrl ?? '');
    this.fetchImpl = options.fetchImpl ?? ((...args) => window.fetch(...args));
  }

  buildUrl(pathname) {
    const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

    if (!this.baseUrl) {
      return normalizedPath;
    }

    return `${this.baseUrl}${normalizedPath}`;
  }

  async getTodayChallenge() {
    const response = await this.fetchImpl(this.buildUrl('/v1/challenge/today'), {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      method: 'GET',
    });

    return parseResponse(response);
  }

  async startRun(payload) {
    const response = await this.fetchImpl(this.buildUrl('/v1/runs/start'), {
      body: JSON.stringify(payload),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    return parseResponse(response);
  }

  async completeRun(payload) {
    const response = await this.fetchImpl(this.buildUrl('/v1/runs/complete'), {
      body: JSON.stringify(payload),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    return parseResponse(response);
  }
}