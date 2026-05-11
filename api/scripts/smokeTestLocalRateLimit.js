const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_IP_LIMIT_ATTEMPTS = 13;
const DEFAULT_PLAYER_LIMIT_ATTEMPTS = 6;
const DEFAULT_IP_LIMIT_TEST_IP = '198.51.100.22';
const DEFAULT_PLAYER_LIMIT_TEST_IP = '198.51.100.11';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function getBaseUrl() {
  return trimTrailingSlash(process.env.POETIC_TYPEWRITER_API_BASE_URL || DEFAULT_BASE_URL);
}

function getPositiveIntegerEnv(key, fallbackValue) {
  const parsed = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
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

function summarizeAttempt(index, response) {
  return {
    code: response.payload?.error?.code ?? null,
    index,
    status: response.status,
  };
}

function createClient(baseUrl, baseHeaders = {}) {
  let cookieHeader = '';

  return {
    async requestJson(pathname, options = {}) {
      const headers = new Headers(baseHeaders);
      const inputHeaders = new Headers(options.headers ?? {});

      inputHeaders.forEach((value, key) => {
        headers.set(key, value);
      });

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
    },
  };
}

async function requestRunStart(client, challengeId, itemId) {
  return client.requestJson('/v1/runs/start', {
    body: JSON.stringify({
      challengeId,
      itemId,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

async function runPlayerScenario(baseUrl, challengeId, itemId) {
  const playerLimitAttempts = getPositiveIntegerEnv(
    'POETIC_TYPEWRITER_PLAYER_LIMIT_ATTEMPTS',
    DEFAULT_PLAYER_LIMIT_ATTEMPTS,
  );
  const expectedBlockedAttempt = getPositiveIntegerEnv(
    'POETIC_TYPEWRITER_PLAYER_LIMIT_BLOCK_AT',
    playerLimitAttempts,
  );
  const client = createClient(baseUrl, {
    'X-Forwarded-For': process.env.POETIC_TYPEWRITER_PLAYER_LIMIT_TEST_IP || DEFAULT_PLAYER_LIMIT_TEST_IP,
  });
  const today = await client.requestJson('/v1/challenge/today');

  if (today.status !== 200) {
    throw new Error(today.payload?.error?.message ?? `today failed with ${today.status}`);
  }

  const attempts = [];
  for (let index = 0; index < playerLimitAttempts; index += 1) {
    const response = await requestRunStart(client, challengeId, itemId);
    attempts.push(summarizeAttempt(index + 1, response));
  }

  const lastAttempt = attempts.at(-1);
  if (
    !lastAttempt ||
    lastAttempt.index !== expectedBlockedAttempt ||
    lastAttempt.status !== 429 ||
    lastAttempt.code !== 'run_start_rate_limited'
  ) {
    throw new Error('player_limit_scenario_failed');
  }

  return attempts;
}

async function runIpScenario(baseUrl, challengeId, itemId) {
  const ipLimitAttempts = getPositiveIntegerEnv('POETIC_TYPEWRITER_IP_LIMIT_ATTEMPTS', DEFAULT_IP_LIMIT_ATTEMPTS);
  const expectedBlockedAttempt = getPositiveIntegerEnv('POETIC_TYPEWRITER_IP_LIMIT_BLOCK_AT', ipLimitAttempts);
  const baseHeaders = {
    'X-Forwarded-For': process.env.POETIC_TYPEWRITER_IP_LIMIT_TEST_IP || DEFAULT_IP_LIMIT_TEST_IP,
  };
  const attempts = [];

  for (let index = 0; index < ipLimitAttempts; index += 1) {
    const client = createClient(baseUrl, baseHeaders);
    const response = await requestRunStart(client, challengeId, itemId);
    attempts.push(summarizeAttempt(index + 1, response));
  }

  const lastAttempt = attempts.at(-1);
  if (
    !lastAttempt ||
    lastAttempt.index !== expectedBlockedAttempt ||
    lastAttempt.status !== 429 ||
    lastAttempt.code !== 'run_start_ip_rate_limited'
  ) {
    throw new Error('ip_limit_scenario_failed');
  }

  return attempts;
}

async function main() {
  const baseUrl = getBaseUrl();
  const bootstrapClient = createClient(baseUrl);
  const today = await bootstrapClient.requestJson('/v1/challenge/today');
  if (today.status !== 200) {
    throw new Error(today.payload?.error?.message ?? `today failed with ${today.status}`);
  }

  const challengeId = today.payload.challengeId;
  const itemId = today.payload.currentItem?.itemId;

  if (!challengeId || !itemId) {
    throw new Error('missing_challenge_bootstrap_data');
  }

  const playerLimitAttempts = await runPlayerScenario(baseUrl, challengeId, itemId);
  const ipLimitAttempts = await runIpScenario(baseUrl, challengeId, itemId);

  console.log(
    JSON.stringify(
      {
        ipLimitAttempts,
        playerLimitAttempts,
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