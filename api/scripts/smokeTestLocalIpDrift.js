const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_START_IP = '198.51.100.31';
const DEFAULT_COMPLETE_IP = '198.51.100.32';

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
  const startIp = process.env.POETIC_TYPEWRITER_START_IP || DEFAULT_START_IP;
  const completeIp = process.env.POETIC_TYPEWRITER_COMPLETE_IP || DEFAULT_COMPLETE_IP;
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

  const today = await requestJson('/v1/challenge/today', {
    headers: {
      'X-Forwarded-For': startIp,
    },
  });
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
      'X-Forwarded-For': startIp,
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
      'X-Forwarded-For': completeIp,
    },
    method: 'POST',
  });
  if (complete.status !== 200) {
    throw new Error(complete.payload?.error?.message ?? `complete failed with ${complete.status}`);
  }

  const refreshedToday = await requestJson('/v1/challenge/today', {
    headers: {
      'X-Forwarded-For': completeIp,
    },
  });
  if (refreshedToday.status !== 200) {
    throw new Error(refreshedToday.payload?.error?.message ?? `refreshed today failed with ${refreshedToday.status}`);
  }

  const summary = {
    allTimeBestCps: complete.payload.allTimeBestCps,
    allTimeRank: complete.payload.allTimeRank,
    currentItemAfterIpDrift: refreshedToday.payload.currentItem?.text ?? null,
    dailyBestCps: complete.payload.dailyBestCps,
    dailyRank: complete.payload.dailyRank,
    leaderboardEligible: complete.payload.leaderboardEligible,
    nextItemAfterIpDrift: complete.payload.nextItem?.text ?? null,
    recentCps: complete.payload.recentCps,
    suspiciousFlags: complete.payload.suspiciousFlags,
    validationStatus: complete.payload.validationStatus,
  };

  console.log(JSON.stringify(summary, null, 2));

  const movedForward =
    complete.payload.nextItem?.itemId &&
    complete.payload.nextItem.itemId !== currentItem.itemId &&
    refreshedToday.payload.currentItem?.itemId === complete.payload.nextItem.itemId;

  if (
    complete.payload.validationStatus !== 'suspicious' ||
    complete.payload.leaderboardEligible !== false ||
    !Array.isArray(complete.payload.suspiciousFlags) ||
    !complete.payload.suspiciousFlags.includes('ip_changed_during_run') ||
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