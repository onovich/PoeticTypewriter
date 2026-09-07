# Poetic Typewriter 在线挑战架构方案

## 方案状态（2026-09-07 更新）

- 本文形成于一次错误决策分支：在用户已明确提供腾讯云轻服务器背景并要求基于现有服务器定方案的情况下，错误地将路线收束为 Cloudflare Worker + D1。
- 用户经过进一步了解后，目前倾向采用 Cloudflare 方案，已要求撤销此前否决约束。本文恢复为当前优先方向的架构草案，现有 Worker + D1 工程可继续评估和完善。
- 原腾讯云优先及月底重规划决定已被取代。文中的拓扑和阶段计划需在实施前核对当前代码；本次更新不表示草案全部细节已定稿或生产部署已完成。此前擅自改变用户路线的历史教训仍保留。

## 文档目的

这份文档用于定义项目从“纯前端打字体验作品”演进到“自由模式 + 每日挑战模式”的目标架构，重点回答产品边界、托管策略、前后端职责、数据结构、接口设计和轻量反作弊策略。

## 约束前提

- 当前线上主链路是静态站部署，仓库已接入 GitHub Pages 与自定义域名跳转。
- 若仓库未来改为私有，免费 GitHub Pages 不再适合作为长期前端托管方案。
- Web 前端代码天然会暴露给浏览器，因此安全模型必须默认“客户端代码、接口地址和请求格式都可见”。
- 安全边界不建立在“别人不知道 API 地址”之上，而建立在“前端不持有高权限密钥，服务端拥有最终裁定权”之上。

## 产品模式拆分

### 自由模式

- 继续保留当前作品的诗意体验属性。
- 内容源仍可来自本地静态数据。
- 不接入全站排行。
- 统计数据只用于本地反馈，不作为服务端真值。

### 每日挑战模式

- 每天提供 100 条内容。
- 玩家完成 1 条后，立即获得本条字速、当日最佳、历史最佳、当日最佳全站排名、历史最佳全站排名。
- 每日挑战成绩由服务端写入和裁定。
- 当日内容不再打包进前端静态资源，而由服务端按天发放。

## 目标托管方案

2026-09-07 实施更新：用户已确认保留现有门户，项目部署于 `https://game.onovich.com/PoeticTypewriter/`。Workers Static Assets + 同域 API 均使用该子路径；预览在独立 `workers.dev` 地址下使用相同路径。生产使用 Workers Routes，不使用接管整个主机名的 Custom Domain。具体操作见 `CLOUDFLARE_DEPLOYMENT.md`。

## 结论

推荐把“静态前端”和“API 服务”都迁移到 Cloudflare 体系，避免后续仓库私有化时继续受 GitHub Pages 限制。

### 生产环境推荐拓扑

- 主站：静态前端，当前配置采用 Cloudflare Workers Static Assets。
- API：部署到 Cloudflare Workers。
- 数据库：Cloudflare D1。
- 主站域名：`game.onovich.com`，由用户于 2026-09-07 指定，不使用 `blog.onovich.com`。此处记录部署目标，DNS 和 Cloudflare 域名绑定尚待实施核验。
- API 地址：预览与生产均为同域 `/PoeticTypewriter/v1/...`，Worker 内部转发至原 `/v1/...` handler。
- 自动化：继续使用 GitHub Actions 触发构建与 Wrangler CLI 部署，无需依赖面板操作。

### 过渡策略

- 在每日挑战模式尚未接入前，现有 GitHub Pages 仍可继续承载自由模式。
- 一旦在线模式开始依赖服务端，建议同步把前端托管从 GitHub Pages 迁出，避免后续切私有仓库时再做二次迁移。

## 系统分层

```text
Browser App
  |- Free Mode Runtime
  |- Daily Challenge Runtime
  |- Public API Base URL
  |- Anonymous Player Identity

Static Frontend Host
  |- Vite build output

API Worker
  |- challenge service
  |- run token service
  |- score validation service
  |- ranking query service

D1 Database
  |- daily challenges
  |- challenge items
  |- players
  |- runs
  |- progress and best snapshots
```

## 前端职责演进

## 当前问题

- 当前 `TypewriterEngine` 同时负责输入推进、DOM 创建、动画推进和阶段切换。
- 如果直接把联网、计时、排行榜逻辑继续塞进引擎，会让后续维护和测试成本显著升高。

## 目标边界

- `TypewriterEngine`：只负责规则推进与视觉对象生命周期，不直接发请求，不直接保存排行结果。
- `createTypewriterApp`：作为组合根，装配模式切换、输入结果统计、服务端调用和视图更新。
- 统计模型：独立维护单条挑战的开始时间、结束时间、退格次数、字速计算和提交载荷。
- 服务客户端：独立负责获取当日内容、按需申请 run token、提交成绩和接收排行摘要。

## 推荐前端模块

- `src/logic/stats/typingRunTracker.js`
  - 负责单条挑战的计时、退格计数、有效输入计数和字速计算。
- `src/logic/services/competitionClient.js`
  - 封装每日挑战相关 API。
- `src/logic/services/challengeSessionStore.js`
  - 负责当前玩家的每日进度、本地缓存和匿名身份持久化。
- `src/data/freePoems.js`
  - 承载自由模式的本地内容。
- `src/data/modes.js`
  - 承载模式、服务端阈值和前端公开配置。

## 输入结果传递建议

不建议让引擎主动持有联网逻辑。更稳妥的做法是让 `handleInput()` 返回结构化结果，由装配层决定下一步动作。

示意：

```js
const inputResult = engine.handleInput(event.key);

if (inputResult.accepted) {
  tracker.recordInput(inputResult);
}

if (inputResult.poemCompleted) {
  const payload = tracker.finishRun();
  const summary = await competitionClient.completeRun(payload);
  statsView.update(summary);
}
```

这条路径比“引擎内部直接调接口”更适合当前项目的渐进式演进。

## 每日挑战内容发放策略

## 关键决策

- 每日 100 条内容不打包进前端。
- 服务端按日期生成当天挑战集。
- 玩家当天的内容顺序由服务端固定，避免刷新页面反复重 roll。
- 完成一条后，服务端在响应里返回下一条内容和最新统计摘要。

## 推荐数据流

1. 前端请求当天挑战摘要。
2. 服务端返回：当天挑战标识、总条数、玩家当前进度、当前条目内容、已有最佳成绩摘要。
3. 玩家触发首个有效输入时，请求一次 run token。
4. 玩家完成后提交成绩。
5. 服务端校验通过后回传：本条成绩、当日最佳、历史最佳、两个排名、下一条内容。

### 为什么不是“题目一出现就签发 token”

- 如果在题目刚加载时就签发 token，而玩家在真正开始打字前停顿较久，服务端记录的时间下限会显著大于真实输入耗时。
- 这样会把正常玩家误判为 `elapsed_below_server_floor`。
- 因此，当前更合理的方案是：题目先展示，等玩家首次有效输入时再向服务端申请一次 run token。

## API 草案

## 1. 获取当天挑战

`GET /v1/challenge/today`

响应示意：

```json
{
  "challengeDate": "2026-05-11",
  "challengeId": "chl_2026_05_11",
  "totalItems": 100,
  "completedItems": 12,
  "currentItem": {
    "itemId": "item_013",
    "text": "hope is the thing with feathers"
  },
  "stats": {
    "dailyBestCps": 6.42,
    "allTimeBestCps": 6.9,
    "dailyRank": 154,
    "allTimeRank": 402
  }
}
```

## 2. 开始一条挑战

`POST /v1/runs/start`

请求示意：

```json
{
  "challengeId": "chl_2026_05_11",
  "itemId": "item_013"
}
```

响应示意：

```json
{
  "runToken": "signed-one-time-token",
  "issuedAt": 1746924000,
  "expiresAt": 1746924060
}
```

## 3. 提交一条挑战成绩

`POST /v1/runs/complete`

请求示意：

```json
{
  "runToken": "signed-one-time-token",
  "challengeId": "chl_2026_05_11",
  "itemId": "item_013",
  "elapsedMs": 4830,
  "backspaceCount": 2,
  "typedLength": 33,
  "inputSample": [420, 390, 410, 380, 450]
}
```

响应示意：

```json
{
  "recentCps": 6.83,
  "dailyBestCps": 6.83,
  "allTimeBestCps": 6.9,
  "dailyRank": 121,
  "allTimeRank": 395,
  "nextItem": {
    "itemId": "item_014",
    "text": "time is a river"
  }
}
```

## 数据库草案

### `players`

- `id`
- `anon_id`
- `created_at`
- `last_seen_at`
- `last_ip_hash`
- `status`

### `daily_challenges`

- `id`
- `challenge_date`
- `seed`
- `item_count`
- `created_at`

### `challenge_items`

- `id`
- `challenge_id`
- `position`
- `text`
- `normalized_text`
- `char_count`

### `player_challenge_progress`

- `id`
- `player_id`
- `challenge_id`
- `completed_items`
- `current_item_position`
- `daily_best_run_id`
- `daily_best_cps`
- `updated_at`

### `runs`

- `id`
- `player_id`
- `challenge_id`
- `item_id`
- `run_token_hash`
- `started_at`
- `completed_at`
- `elapsed_ms_client`
- `elapsed_ms_server_floor`
- `backspace_count`
- `typed_length`
- `cps`
- `validation_status`
- `suspicious_flags`

### `player_all_time_best`

- `player_id`
- `best_run_id`
- `best_cps`
- `updated_at`

## 排名计算建议

- 当日排名：基于 `player_challenge_progress.daily_best_cps` 排序。
- 历史排名：基于 `player_all_time_best.best_cps` 排序。
- 同分时优先更低 `elapsedMs`，再优先更早提交时间。
- 当前体量较小时可直接用 SQL 查询排名；当数据量明显增长后，再考虑快照表或预聚合。

## 轻量反作弊策略

## 原则

- 不追求军事级防护，只拦截明显离谱的作弊。
- 不让前端拥有任何可直接写库的高权限凭证。
- 服务端拥有成绩是否入榜的最终裁定权。

## 第一层：匿名身份

- 前端本地保存匿名 `playerId`。
- 服务端再辅以 HttpOnly cookie 识别，减少简单重置本地存储的收益。

## 第二层：一次性 run token

- 每一条开始前由服务端签发一次短时有效 token。
- 在当前实现里，“开始前”具体指“首个有效字符被接受时”，不是“题目刚被展示时”。
- token 绑定 `playerId + challengeId + itemId + issuedAt`。
- token 只能使用一次，提交后立即失效。

## 第三层：基础成绩校验

- 服务端校验 `itemId` 是否是该玩家当前应答条目。
- 服务端校验 token 是否未过期、未重放、未跨玩家使用。
- 服务端以自己记录的签发时间计算最低耗时下限，不完全相信客户端 `elapsedMs`。
- 服务端校验 `typedLength` 是否与题目长度一致。

## 第四层：轻量异常筛查

- 极端高字速直接拒绝。
- 可疑字速、极端平滑输入节奏、过高短时提交频率标记为 `suspicious`。
- 被标记为 `suspicious` 的成绩可以保留给玩家本地反馈，但不进入全站排行。
- 当前已落地的 `suspicious` 规则包括：高字速阈值、输入间隔过于平滑、同一玩家在 15 秒窗口内出现第 5 次非拒绝完成提交，以及同一条 run 在起跑和提交之间发生 IP 变化。

## 第五层：基础请求限流

- 当前已实现玩家级 + IP 级双层 `run start` 近窗限流，用于阻止同一匿名玩家刷 token，也阻止通过批量切换匿名玩家绕过限流。
- 当前默认值为：单玩家 60 秒内最多 5 次 `run start`；单 IP 60 秒内最多 12 次 `run start`。
- 这层限流优先保护 token 签发路径，不直接干预正常的单次完成提交流程。
- 更细的分层阈值和线上真实流量校准仍保留到下一阶段继续收口。

## 初始阈值建议

- 将阈值配置化，不写死在逻辑里。
- 初始版本可先以较保守的经验值上线，再依据真实数据调整。
- 阈值建议拆成三类：硬拒绝阈值、可疑阈值、限流阈值。

## 前端公开信息的安全结论

- 前端代码默认可见，这本身不是风险。
- API 地址写在前端里属于正常做法。
- 真正不能进入前端的是数据库密钥、服务端签名密钥、管理员令牌和任何可绕过校验的高权限配置。
- 前端只应持有公开 base URL、公开模式配置和匿名身份标识。

## 分阶段实施计划

### Phase 1：前端边界收口

- 把自由模式内容与每日挑战内容的来源分开。
- 让 `TypewriterEngine.handleInput()` 返回结构化输入结果。
- 引入独立的 `typingRunTracker`，不在引擎内部直接算排行提交载荷。

完成判定：

- 自由模式仍然行为不回退。
- 引擎不直接依赖网络层。
- 装配层可以拿到单条完成结果。

### Phase 2：最小服务端接入

- 建立 Worker + D1 工程。
- 打通当天挑战获取、run token 签发和单条成绩提交。
- 返回最近成绩、当日最佳、历史最佳和两个排名。

完成判定：

- 玩家可以完整完成“获取条目 -> 输入 -> 提交 -> 收到下一条”的闭环。
- 服务端成为每日挑战成绩的唯一真值来源。

### Phase 3：轻量反作弊与运维完善

- 已加入 IP 和玩家维度限流，并把起跑/提交 IP 变化纳入 `suspicious` 判定，下一步重点转为阈值校准。
- 对异常成绩做标记或拒绝。
- 补充每日题库生成脚本、数据库迁移脚本和 CLI 部署脚本。

完成判定：

- 明显离谱的提交无法进入排行。
- 线上部署不依赖手工面板操作。

## 当前推荐执行顺序

1. 先做 Phase 1，把前端边界收口。
2. 再建立独立的 Worker + D1 服务端工程。
3. 然后接入每日挑战模式。
4. 最后才补排行榜优化和反作弊阈值调参。

这条顺序能最大限度避免在现有引擎耦合状态下直接硬接服务端，降低返工风险。
