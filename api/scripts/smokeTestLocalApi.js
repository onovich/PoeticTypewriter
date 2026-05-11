const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function getBaseUrl() {
  return trimTrailingSlash(process.env.POETIC_TYPEWRITER_API_BASE_URL || DEFAULT_BASE_URL);
}

async function parseJsonOrThrow(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function getCookieHeader(setCookieHeader) {
  if (!setCookieHeader) {
    return '';
  }

  return setCookieHeader.split(';')[0].trim();
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

    const nextCookieHeader = getCookieHeader(response.headers.get('set-cookie'));
    if (nextCookieHeader) {
      cookieHeader = nextCookieHeader;
    }

    return parseJsonOrThrow(response);
  };

  const health = await requestJson('/health');
  const today = await requestJson('/v1/challenge/today');
  const start = await requestJson('/v1/runs/start', {
    body: JSON.stringify({
      challengeId: today.challengeId,
      itemId: today.currentItem.itemId,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const complete = await requestJson('/v1/runs/complete', {
    body: JSON.stringify({
      backspaceCount: 1,
      challengeId: today.challengeId,
      elapsedMs: 5200,
      inputSample: [430, 410, 450, 420, 440],
      itemId: today.currentItem.itemId,
      runToken: start.runToken,
      typedLength: today.currentItem.text.length,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  console.log(
    JSON.stringify(
      {
        allTimeBestCps: complete.allTimeBestCps,
        challengeId: today.challengeId,
        currentItem: today.currentItem.text,
        dailyBestCps: complete.dailyBestCps,
        healthOk: health.ok,
        leaderboardEligible: complete.leaderboardEligible,
        nextItem: complete.nextItem?.text ?? null,
        recentCps: complete.recentCps,
        runTokenIssued: Boolean(start.runToken),
        validationStatus: complete.validationStatus,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});