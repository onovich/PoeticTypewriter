const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_HARD_CPS_LIMIT = 20;
const DEFAULT_SERVER_FLOOR_TOLERANCE_MS = 250;

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

function getPositiveIntegerEnv(key, fallbackValue) {
  const parsed = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
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
  const hardCpsLimit = getPositiveIntegerEnv('POETIC_TYPEWRITER_HARD_CPS_LIMIT', DEFAULT_HARD_CPS_LIMIT);
  const toleranceMs = getPositiveIntegerEnv(
    'POETIC_TYPEWRITER_SERVER_FLOOR_TOLERANCE_MS',
    DEFAULT_SERVER_FLOOR_TOLERANCE_MS,
  );
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

  const currentItem = today.payload.currentItem;
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

  const typedLength = currentItem.text.length;
  const elapsedMs = Math.max(1, Math.floor((typedLength * 1000) / (hardCpsLimit + 5)));
  const waitBeforeCompleteMs = elapsedMs + Math.max(50, Math.floor(toleranceMs / 2));
  await new Promise((resolve) => setTimeout(resolve, waitBeforeCompleteMs));

  const complete = await requestJson('/v1/runs/complete', {
    body: JSON.stringify({
      backspaceCount: 0,
      challengeId: today.payload.challengeId,
      elapsedMs,
      inputSample: [410, 520, 390, 480, 430],
      itemId: currentItem.itemId,
      runToken: start.payload.runToken,
      typedLength,
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
    currentItemAfterRejectedRun: refreshedToday.payload.currentItem?.text ?? null,
    dailyBestCps: complete.payload.dailyBestCps,
    dailyRank: complete.payload.dailyRank,
    leaderboardEligible: complete.payload.leaderboardEligible,
    nextItemAfterRejectedRun: complete.payload.nextItem?.text ?? null,
    recentCps: complete.payload.recentCps,
    suspiciousFlags: complete.payload.suspiciousFlags,
    validationStatus: complete.payload.validationStatus,
  };

  console.log(JSON.stringify(summary, null, 2));

  const stayedOnSameItem =
    complete.payload.nextItem?.itemId === currentItem.itemId &&
    refreshedToday.payload.currentItem?.itemId === currentItem.itemId;

  if (
    complete.payload.validationStatus !== 'rejected' ||
    !Array.isArray(complete.payload.suspiciousFlags) ||
    !complete.payload.suspiciousFlags.includes('hard_cps_limit') ||
    complete.payload.leaderboardEligible !== false ||
    complete.payload.dailyBestCps !== 0 ||
    complete.payload.dailyRank !== null ||
    complete.payload.allTimeBestCps !== 0 ||
    complete.payload.allTimeRank !== null ||
    !stayedOnSameItem
  ) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});