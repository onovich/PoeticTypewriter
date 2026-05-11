const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function getBaseUrl() {
  return trimTrailingSlash(process.env.POETIC_TYPEWRITER_API_BASE_URL || DEFAULT_BASE_URL);
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

  const start = await requestJson('/v1/runs/start', {
    body: JSON.stringify({
      challengeId: today.payload.challengeId,
      itemId: today.payload.currentItem.itemId,
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
      backspaceCount: 0,
      challengeId: today.payload.challengeId,
      elapsedMs: 5200,
      inputSample: [400, 406, 401, 404],
      itemId: today.payload.currentItem.itemId,
      runToken: start.payload.runToken,
      typedLength: today.payload.currentItem.text.length,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  if (complete.status !== 200) {
    throw new Error(complete.payload?.error?.message ?? `complete failed with ${complete.status}`);
  }

  const refreshedToday = await requestJson('/v1/challenge/today');
  if (refreshedToday.status !== 200) {
    throw new Error(refreshedToday.payload?.error?.message ?? `refreshed today failed with ${refreshedToday.status}`);
  }

  const summary = {
    allTimeBestCps: complete.payload.allTimeBestCps,
    allTimeRank: complete.payload.allTimeRank,
    currentItemAfterSuspiciousRun: refreshedToday.payload.currentItem?.text ?? null,
    dailyBestCps: complete.payload.dailyBestCps,
    dailyRank: complete.payload.dailyRank,
    nextItemAfterSuspiciousRun: complete.payload.nextItem?.text ?? null,
    recentCps: complete.payload.recentCps,
    suspiciousFlags: complete.payload.suspiciousFlags,
    validationStatus: complete.payload.validationStatus,
  };

  console.log(JSON.stringify(summary, null, 2));

  const movedForward =
    complete.payload.nextItem?.itemId &&
    complete.payload.nextItem.itemId !== today.payload.currentItem.itemId &&
    refreshedToday.payload.currentItem?.itemId === complete.payload.nextItem.itemId;

  if (
    complete.payload.validationStatus !== 'suspicious' ||
    !Array.isArray(complete.payload.suspiciousFlags) ||
    !complete.payload.suspiciousFlags.includes('uniform_input_sample') ||
    complete.payload.dailyBestCps !== 0 ||
    complete.payload.dailyRank !== null ||
    complete.payload.allTimeBestCps !== 0 ||
    complete.payload.allTimeRank !== null ||
    !movedForward
  ) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});