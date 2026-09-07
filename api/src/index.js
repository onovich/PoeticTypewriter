import { errorResponse, jsonResponse, optionsResponse } from './http.js';
import { handleCompleteRun, handleGetToday, handleStartRun } from './service.js';

function assertRequiredConfig(env) {
  if (!env.DB) {
    throw new Error('missing_db_binding');
  }

  if (!env.RUN_TOKEN_SECRET) {
    throw new Error('missing_run_token_secret');
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return optionsResponse(request, env);
    }

    try {
      assertRequiredConfig(env);

      const url = new URL(request.url);

      if (request.method === 'GET' && url.pathname === '/health') {
        return jsonResponse(request, env, {
          ok: true,
          service: 'poetic-typewriter-api',
          timestamp: new Date().toISOString(),
        });
      }

      if (request.method === 'GET' && url.pathname === '/v1/challenge/today') {
        return await handleGetToday(request, env);
      }

      if (request.method === 'POST' && url.pathname === '/v1/runs/start') {
        return await handleStartRun(request, env);
      }

      if (request.method === 'POST' && url.pathname === '/v1/runs/complete') {
        return await handleCompleteRun(request, env);
      }

      return errorResponse(request, env, 404, 'not_found', '未找到对应的 API 路由。');
    } catch (error) {
      if (error?.code === 'invalid_json') {
        return errorResponse(request, env, 400, 'invalid_json', '请求体不是合法 JSON。');
      }

      if (error?.message === 'missing_db_binding') {
        return errorResponse(request, env, 500, 'missing_db_binding', 'Worker 缺少 D1 绑定。');
      }

      if (error?.message === 'missing_run_token_secret') {
        return errorResponse(request, env, 500, 'missing_run_token_secret', 'Worker 缺少 RUN_TOKEN_SECRET。');
      }

      console.error(error);
      return errorResponse(request, env, 500, 'internal_error', '服务端发生未处理异常。');
    }
  },
};
