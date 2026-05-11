import { buildPlayerCookie, PLAYER_COOKIE_NAME, readCookie } from './cookies.js';
import { errorResponse, jsonResponse, readJson } from './http.js';
import {
  advancePlayerProgress,
  countRecentRunStartsByIp,
  countRecentRunStartsByPlayer,
  completeRun,
  getAllTimeBest,
  getAllTimeRank,
  getChallengeByDate,
  getChallengeById,
  getChallengeItemById,
  getChallengeItemByPosition,
  getDailyRank,
  getOrCreatePlayer,
  getOrCreatePlayerProgress,
  getRunByTokenHash,
  recordRunStart,
  updateDailyBest,
  upsertAllTimeBest,
} from './repository.js';
import { createSignedRunToken, sha256Base64Url, verifySignedRunToken } from './tokens.js';

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getNowIso() {
  return new Date().toISOString();
}

function getNumberEnv(env, key, fallbackValue) {
  const value = Number(env[key]);
  return Number.isFinite(value) ? value : fallbackValue;
}

function getRunConfig(env) {
  const runStartLimitMax = getNumberEnv(env, 'RUN_START_LIMIT_MAX', 5);
  const runStartLimitWindowMs = getNumberEnv(env, 'RUN_START_LIMIT_WINDOW_MS', 60_000);

  return {
    hardCpsLimit: getNumberEnv(env, 'HARD_CPS_LIMIT', 20),
    runStartIpLimitMax: getNumberEnv(env, 'RUN_START_IP_LIMIT_MAX', 12),
    runStartIpLimitWindowMs: getNumberEnv(env, 'RUN_START_IP_LIMIT_WINDOW_MS', runStartLimitWindowMs),
    runStartLimitMax,
    runStartLimitWindowMs,
    runTokenTtlMs: getNumberEnv(env, 'RUN_TOKEN_TTL_MS', 300_000),
    serverFloorToleranceMs: getNumberEnv(env, 'SERVER_FLOOR_TOLERANCE_MS', 250),
    suspiciousCpsLimit: getNumberEnv(env, 'SUSPICIOUS_CPS_LIMIT', 12),
    suspiciousSampleVarianceMin: getNumberEnv(env, 'SUSPICIOUS_SAMPLE_VARIANCE_MIN', 12),
  };
}

function getIsoBeforeWindow(windowMs) {
  return new Date(Date.now() - windowMs).toISOString();
}

function clampPositiveInteger(value, fallbackValue = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallbackValue;
  }

  return parsed;
}

function sanitizeInputSample(inputSample) {
  if (!Array.isArray(inputSample)) {
    return [];
  }

  return inputSample
    .map((value) => clampPositiveInteger(value, 0))
    .filter((value) => value > 0)
    .slice(0, 12);
}

function collectSuspiciousFlags(metrics, config) {
  const suspiciousFlags = [];

  if (metrics.cps >= config.suspiciousCpsLimit) {
    suspiciousFlags.push('high_cps');
  }

  if (metrics.inputSample.length >= 4) {
    const minValue = Math.min(...metrics.inputSample);
    const maxValue = Math.max(...metrics.inputSample);
    if (maxValue - minValue <= config.suspiciousSampleVarianceMin) {
      suspiciousFlags.push('uniform_input_sample');
    }
  }

  return suspiciousFlags;
}

async function resolvePlayerContext(request, env) {
  const existingAnonId = readCookie(request, PLAYER_COOKIE_NAME);
  const anonId = existingAnonId ?? crypto.randomUUID();
  const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? '';
  const ipHash = ip ? await sha256Base64Url(ip) : null;
  const player = await getOrCreatePlayer(env.DB, {
    anonId,
    ipHash,
    nowIso: getNowIso(),
  });

  const headers = new Headers();
  if (!existingAnonId) {
    headers.append('Set-Cookie', buildPlayerCookie(anonId, env));
  }

  return {
    headers,
    ipHash,
    player,
  };
}

async function buildStatsSnapshot(db, playerId, challengeId, dailyBestCps) {
  const allTimeBest = await getAllTimeBest(db, playerId);

  return {
    allTimeBestCps: Number(allTimeBest.best_cps ?? 0),
    allTimeRank: Number(allTimeBest.best_cps ?? 0) > 0 ? await getAllTimeRank(db, playerId) : null,
    dailyBestCps: Number(dailyBestCps ?? 0),
    dailyRank: Number(dailyBestCps ?? 0) > 0 ? await getDailyRank(db, challengeId, playerId) : null,
  };
}

export async function handleGetToday(request, env) {
  const playerContext = await resolvePlayerContext(request, env);
  const challengeDate = getTodayIsoDate();
  const challenge = await getChallengeByDate(env.DB, challengeDate);

  if (!challenge) {
    return errorResponse(request, env, 404, 'challenge_not_found', '今天的挑战内容还没有入库。', {
      headers: playerContext.headers,
    });
  }

  const progress = await getOrCreatePlayerProgress(env.DB, {
    challengeId: challenge.id,
    nowIso: getNowIso(),
    playerId: playerContext.player.id,
  });
  const currentItem = await getChallengeItemByPosition(env.DB, challenge.id, progress.current_item_position);
  const stats = await buildStatsSnapshot(env.DB, playerContext.player.id, challenge.id, progress.daily_best_cps);

  return jsonResponse(
    request,
    env,
    {
      challengeDate,
      challengeId: challenge.id,
      completedItems: progress.completed_items,
      currentItem: currentItem
        ? {
            itemId: currentItem.id,
            text: currentItem.text,
          }
        : null,
      stats,
      totalItems: challenge.item_count,
    },
    {
      headers: playerContext.headers,
    },
  );
}

export async function handleStartRun(request, env) {
  const playerContext = await resolvePlayerContext(request, env);
  const body = await readJson(request);
  const challengeId = body?.challengeId;
  const itemId = body?.itemId;

  if (!challengeId || !itemId) {
    return errorResponse(request, env, 400, 'invalid_run_start', 'challengeId 和 itemId 都是必填项。', {
      headers: playerContext.headers,
    });
  }

  const challenge = await getChallengeById(env.DB, challengeId);
  if (!challenge) {
    return errorResponse(request, env, 404, 'challenge_not_found', '指定的挑战不存在。', {
      headers: playerContext.headers,
    });
  }

  const progress = await getOrCreatePlayerProgress(env.DB, {
    challengeId,
    nowIso: getNowIso(),
    playerId: playerContext.player.id,
  });
  const currentItem = await getChallengeItemByPosition(env.DB, challengeId, progress.current_item_position);

  if (!currentItem || currentItem.id !== itemId) {
    return errorResponse(request, env, 409, 'unexpected_item', '当前条目与玩家进度不匹配。', {
      headers: playerContext.headers,
    });
  }

  const config = getRunConfig(env);
  const recentRunStartCount = await countRecentRunStartsByPlayer(
    env.DB,
    playerContext.player.id,
    getIsoBeforeWindow(config.runStartLimitWindowMs),
  );

  if (recentRunStartCount >= config.runStartLimitMax) {
    return errorResponse(request, env, 429, 'run_start_rate_limited', 'run token 请求过于频繁，请稍后再试。', {
      headers: playerContext.headers,
    });
  }

  if (playerContext.ipHash) {
    const recentRunStartIpCount = await countRecentRunStartsByIp(
      env.DB,
      playerContext.ipHash,
      getIsoBeforeWindow(config.runStartIpLimitWindowMs),
    );

    if (recentRunStartIpCount >= config.runStartIpLimitMax) {
      return errorResponse(
        request,
        env,
        429,
        'run_start_ip_rate_limited',
        '当前网络环境的 run token 请求过于频繁，请稍后再试。',
        {
          headers: playerContext.headers,
        },
      );
    }
  }

  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + config.runTokenTtlMs;
  const runToken = await createSignedRunToken(
    {
      challengeId,
      expiresAtMs,
      issuedAtMs,
      itemId,
      playerId: playerContext.player.id,
    },
    env.RUN_TOKEN_SECRET,
  );
  const tokenHash = await sha256Base64Url(runToken);

  await recordRunStart(env.DB, {
    challengeId,
    itemId,
    playerId: playerContext.player.id,
    startedAt: getNowIso(),
    startedIpHash: playerContext.ipHash,
    tokenHash,
  });

  return jsonResponse(
    request,
    env,
    {
      expiresAt: Math.floor(expiresAtMs / 1000),
      issuedAt: Math.floor(issuedAtMs / 1000),
      runToken,
    },
    {
      headers: playerContext.headers,
    },
  );
}

export async function handleCompleteRun(request, env) {
  const playerContext = await resolvePlayerContext(request, env);
  const body = await readJson(request);
  const runToken = body?.runToken;
  const challengeId = body?.challengeId;
  const itemId = body?.itemId;

  if (!runToken || !challengeId || !itemId) {
    return errorResponse(request, env, 400, 'invalid_run_complete', 'runToken、challengeId 和 itemId 都是必填项。', {
      headers: playerContext.headers,
    });
  }

  const verifiedToken = await verifySignedRunToken(runToken, env.RUN_TOKEN_SECRET);
  if (!verifiedToken) {
    return errorResponse(request, env, 401, 'invalid_run_token', 'run token 无效。', {
      headers: playerContext.headers,
    });
  }

  if (
    verifiedToken.playerId !== playerContext.player.id ||
    verifiedToken.challengeId !== challengeId ||
    verifiedToken.itemId !== itemId
  ) {
    return errorResponse(request, env, 403, 'run_token_mismatch', 'run token 与当前玩家或条目不匹配。', {
      headers: playerContext.headers,
    });
  }

  const tokenHash = await sha256Base64Url(runToken);
  const run = await getRunByTokenHash(env.DB, tokenHash);
  if (!run || run.validation_status !== 'started') {
    return errorResponse(request, env, 409, 'run_already_used', '这个 run token 已经使用过，或并不存在。', {
      headers: playerContext.headers,
    });
  }

  const challenge = await getChallengeById(env.DB, challengeId);
  if (!challenge) {
    return errorResponse(request, env, 404, 'challenge_not_found', '指定的挑战不存在。', {
      headers: playerContext.headers,
    });
  }

  const progress = await getOrCreatePlayerProgress(env.DB, {
    challengeId,
    nowIso: getNowIso(),
    playerId: playerContext.player.id,
  });
  const currentItem = await getChallengeItemByPosition(env.DB, challengeId, progress.current_item_position);
  const challengeItem = await getChallengeItemById(env.DB, itemId);

  if (!currentItem || currentItem.id !== itemId || !challengeItem || challengeItem.challenge_id !== challengeId) {
    return errorResponse(request, env, 409, 'unexpected_item', '提交的条目与当前进度不匹配。', {
      headers: playerContext.headers,
    });
  }

  const elapsedMs = clampPositiveInteger(body.elapsedMs);
  const typedLength = clampPositiveInteger(body.typedLength);
  const backspaceCount = clampPositiveInteger(body.backspaceCount);
  const inputSample = sanitizeInputSample(body.inputSample);

  if (elapsedMs <= 0) {
    return errorResponse(request, env, 400, 'invalid_elapsed_ms', 'elapsedMs 必须是正整数。', {
      headers: playerContext.headers,
    });
  }

  if (typedLength !== challengeItem.char_count) {
    return errorResponse(request, env, 422, 'typed_length_mismatch', 'typedLength 与题目长度不一致。', {
      headers: playerContext.headers,
    });
  }

  if (Date.now() > verifiedToken.expiresAtMs) {
    await completeRun(env.DB, {
      backspaceCount,
      completedAt: getNowIso(),
      cps: 0,
      elapsedMsClient: elapsedMs,
      elapsedMsServerFloor: 0,
      runId: run.id,
      suspiciousFlags: ['expired_token'],
      typedLength,
      validationStatus: 'rejected',
    });

    return errorResponse(request, env, 410, 'expired_run_token', 'run token 已过期。', {
      headers: playerContext.headers,
    });
  }

  const config = getRunConfig(env);
  const serverFloorMs = Math.max(1, Date.now() - verifiedToken.issuedAtMs);
  if (elapsedMs < Math.max(1, serverFloorMs - config.serverFloorToleranceMs)) {
    await completeRun(env.DB, {
      backspaceCount,
      completedAt: getNowIso(),
      cps: 0,
      elapsedMsClient: elapsedMs,
      elapsedMsServerFloor: serverFloorMs,
      runId: run.id,
      suspiciousFlags: ['elapsed_below_server_floor'],
      typedLength,
      validationStatus: 'rejected',
    });

    return errorResponse(request, env, 422, 'elapsed_below_server_floor', '本次提交的耗时低于服务端允许的最小下限。', {
      headers: playerContext.headers,
    });
  }

  const cps = Number((typedLength / (elapsedMs / 1000)).toFixed(2));
  const suspiciousFlags = collectSuspiciousFlags(
    {
      cps,
      inputSample,
    },
    config,
  );

  let validationStatus = 'accepted';
  if (cps >= config.hardCpsLimit) {
    suspiciousFlags.push('hard_cps_limit');
    validationStatus = 'rejected';
  } else if (suspiciousFlags.length > 0) {
    validationStatus = 'suspicious';
  }

  await completeRun(env.DB, {
    backspaceCount,
    completedAt: getNowIso(),
    cps,
    elapsedMsClient: elapsedMs,
    elapsedMsServerFloor: serverFloorMs,
    runId: run.id,
    suspiciousFlags,
    typedLength,
    validationStatus,
  });

  if (validationStatus !== 'rejected') {
    const nextPosition = currentItem.position + 1;
    await advancePlayerProgress(env.DB, {
      completedItems: currentItem.position,
      currentItemPosition: nextPosition,
      progressId: progress.id,
      updatedAt: getNowIso(),
    });

    if (validationStatus === 'accepted' && cps > Number(progress.daily_best_cps ?? 0)) {
      await updateDailyBest(env.DB, {
        cps,
        progressId: progress.id,
        runId: run.id,
        updatedAt: getNowIso(),
      });
    }

    const currentAllTimeBest = await getAllTimeBest(env.DB, playerContext.player.id);
    if (validationStatus === 'accepted' && cps > Number(currentAllTimeBest.best_cps ?? 0)) {
      await upsertAllTimeBest(env.DB, {
        cps,
        playerId: playerContext.player.id,
        runId: run.id,
        updatedAt: getNowIso(),
      });
    }
  }

  const refreshedProgress = await getOrCreatePlayerProgress(env.DB, {
    challengeId,
    nowIso: getNowIso(),
    playerId: playerContext.player.id,
  });
  const nextItem = await getChallengeItemByPosition(env.DB, challengeId, refreshedProgress.current_item_position);
  const stats = await buildStatsSnapshot(env.DB, playerContext.player.id, challengeId, refreshedProgress.daily_best_cps);

  return jsonResponse(
    request,
    env,
    {
      allTimeBestCps: stats.allTimeBestCps,
      allTimeRank: stats.allTimeRank,
      dailyBestCps: stats.dailyBestCps,
      dailyRank: stats.dailyRank,
      nextItem: nextItem
        ? {
            itemId: nextItem.id,
            text: nextItem.text,
          }
        : null,
      recentCps: cps,
      suspiciousFlags,
      validationStatus,
    },
    {
      headers: playerContext.headers,
    },
  );
}