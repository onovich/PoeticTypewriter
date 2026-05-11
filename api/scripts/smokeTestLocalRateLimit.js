const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function getBaseUrl() {
  return trimTrailingSlash(process.env.POETIC_TYPEWRITER_API_BASE_URL || DEFAULT_BASE_URL);
}

function getCookieHeader(setCookieHeader) {
  if (!setCookieHeader) {
    return '';
  }

  return setCookieHeader.split(';')[0].trim();
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => null);
  const nextCookie = getCookieHeader(response.headers.get('set-cookie'));

  return {
    nextCookie,
    payload,
    status: response.status,
  };
}

async function main() {
  const baseUrl = getBaseUrl();
  let cookieHeader = '';

  const requestJson = async (pathname, options = {}) => {
    const headers = new Headers(options.headers ?? {});
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader);
    }

    const response = await fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers,
    });
    const parsed = await parseResponse(response);

    if (parsed.nextCookie) {
      cookieHeader = parsed.nextCookie;
    }

    return parsed;
  };

  const today = await requestJson('/v1/challenge/today');
  if (today.status !== 200) {
    throw new Error(today.payload?.error?.message ?? `today failed with ${today.status}`);
  }

  const attempts = [];
  for (let index = 0; index < 6; index += 1) {
    const attempt = await requestJson('/v1/runs/start', {
      body: JSON.stringify({
        challengeId: today.payload.challengeId,
        itemId: today.payload.currentItem.itemId,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    attempts.push({
      code: attempt.payload?.error?.code ?? null,
      index: index + 1,
      status: attempt.status,
    });
  }

  console.log(JSON.stringify({ attempts }, null, 2));

  const lastAttempt = attempts.at(-1);
  if (!lastAttempt || lastAttempt.status !== 429 || lastAttempt.code !== 'run_start_rate_limited') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});