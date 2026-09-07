function mergeHeaders(targetHeaders, inputHeaders) {
  if (!inputHeaders) {
    return;
  }

  const headers = new Headers(inputHeaders);
  headers.forEach((value, key) => {
    targetHeaders.append(key, value);
  });
}

export function buildCorsHeaders(request, env) {
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigin = env.ALLOWED_ORIGIN || requestOrigin || '*';
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Origin': allowedOrigin,
    Vary: 'Origin',
  });

  if (allowedOrigin !== '*') {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return headers;
}

export function jsonResponse(request, env, data, init = {}) {
  const headers = buildCorsHeaders(request, env);
  mergeHeaders(headers, init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');

  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers,
  });
}

export function errorResponse(request, env, status, code, message, init = {}) {
  return jsonResponse(
    request,
    env,
    {
      error: {
        code,
        message,
      },
    },
    {
      ...init,
      status,
    },
  );
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    const error = new Error('invalid_json');
    error.code = 'invalid_json';
    throw error;
  }
}

export function optionsResponse(request, env) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request, env),
  });
}
