const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_ATTEMPTS = 5;

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

  let currentItem = today.payload.currentItem;
  const attempts = [];

  for (let index = 0; index < DEFAULT_ATTEMPTS; index += 1) {
    if (!currentItem?.itemId || !currentItem?.text) {
      throw new Error('missing_current_item');
    }

    const start = await requestJson('/v1/runs/start', {
      body: JSON.stringify({
        challengeId: today.payload.challengeId,
        itemId: currentItem.itemId,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    if (start.status !== 200) {
      throw new Error(start.payload?.error?.message ?? `start failed with ${start.status}`);
    }

    const complete = await requestJson('/v1/runs/complete', {
      body: JSON.stringify({
        backspaceCount: 1,
        challengeId: today.payload.challengeId,
        elapsedMs: 5200,
        inputSample: [430, 520, 395, 470, 445],
        itemId: currentItem.itemId,
        runToken: start.payload.runToken,
        typedLength: currentItem.text.length,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    if (complete.status !== 200) {
      throw new Error(complete.payload?.error?.message ?? `complete failed with ${complete.status}`);
    }

    attempts.push({
      allTimeBestCps: complete.payload.allTimeBestCps,
      allTimeRank: complete.payload.allTimeRank,
      dailyBestCps: complete.payload.dailyBestCps,
      dailyRank: complete.payload.dailyRank,
      index: index + 1,
      recentCps: complete.payload.recentCps,
      suspiciousFlags: complete.payload.suspiciousFlags,
      validationStatus: complete.payload.validationStatus,
    });

    currentItem = complete.payload.nextItem;
  }

  console.log(JSON.stringify({ attempts }, null, 2));

  const lastAttempt = attempts.at(-1);
  const previousAttempt = attempts.at(-2);
  if (
    !lastAttempt ||
    lastAttempt.validationStatus !== 'suspicious' ||
    !Array.isArray(lastAttempt.suspiciousFlags) ||
    !lastAttempt.suspiciousFlags.includes('high_submission_rate') ||
    !previousAttempt ||
    lastAttempt.dailyBestCps !== previousAttempt.dailyBestCps ||
    lastAttempt.allTimeBestCps !== previousAttempt.allTimeBestCps
  ) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});