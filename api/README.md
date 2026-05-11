# Poetic Typewriter API

这个目录承载每日挑战模式的 Cloudflare Worker + D1 服务端工程。

## 当前范围

- 已提供每日挑战接口骨架：`GET /health`、`GET /v1/challenge/today`、`POST /v1/runs/start`、`POST /v1/runs/complete`
- 已提供 D1 初始迁移
- 已提供原创题库池与每日 100 条 SQL 生成脚本
- 已提供基于 CLI 的本地检查、开发与部署入口

## 使用方式

1. 进入目录：`cd api`
2. 安装依赖：`npm install`
3. 创建 D1：`npx wrangler d1 create poetic-typewriter`
4. 将返回的 `database_id` 和 `preview_database_id` 回填到 `wrangler.toml`
5. 按你的前端域名回填 `ALLOWED_ORIGIN`
6. 本地开发请先复制 `.dev.vars.example` 为 `.dev.vars`，并写入 `RUN_TOKEN_SECRET`
7. 远端环境通过 CLI secret 设置 `RUN_TOKEN_SECRET`：`npx wrangler secret put RUN_TOKEN_SECRET`
8. 应用迁移：`npx wrangler d1 migrations apply poetic-typewriter --local`
9. 生成当天题库 SQL：`npm run challenge:sql -- --out ../.local/daily-challenge.sql`
10. 灌入本地 D1：`npx wrangler d1 execute poetic-typewriter --local --file ../.local/daily-challenge.sql`
11. 本地语法检查：`npm run check`
12. 本地开发：`npm run dev`
13. 远端部署：`npm run deploy`

如果你只想快速把本地 D1 准备到“今天可玩”的状态，可以直接运行：

- `npm run db:bootstrap:local`

它会自动：

- 生成当天 100 条挑战 SQL 到仓库根目录下的 `.local/challenges/`
- 执行本地 D1 migration
- 将当天挑战写入本地 D1

如果你已经完成远端 D1 和 secret 配置，也可以用同一套命令直接准备远端当天挑战：

- `npm run db:bootstrap:remote -- --date 2026-05-11`

它会自动：

- 生成当天 100 条挑战 SQL 到仓库根目录下的 `.local/challenges/`
- 执行远端 D1 migration
- 将当天挑战写入远端 D1

前提：

- `wrangler.toml` 中的远端 `database_id` 和 `preview_database_id` 已替换为真实值
- 远端 Worker 所需 secret 已通过 CLI 配好

如果本地 Worker 已经启动，还可以直接跑一次 CLI smoke test：

- `npm run smoke:local`
- `npm run smoke:rate-limit`
- `npm run smoke:submission-rate`
- `npm run smoke:suspicious`

它会顺序验证：

- `GET /health`
- `GET /v1/challenge/today`
- `POST /v1/runs/start`
- `POST /v1/runs/complete`

其中 `smoke:rate-limit` 会连续请求 6 次 `POST /v1/runs/start`，确认第 6 次返回 `429 run_start_rate_limited`。
它还会额外模拟“同一 IP 下连续创建多个匿名玩家”的场景，确认第 13 次返回 `429 run_start_ip_rate_limited`。
`smoke:submission-rate` 会连续完成多条正常成绩，确认短时间内过高的完成频率会把当前成绩标记为 `suspicious`，同时不会刷新 best 和排行。
`smoke:suspicious` 会提交一次可疑但不拒绝的成绩，确认它会推进到下一题，但不会更新当日最佳、历史最佳或对应排名。

## 本地开发环境

- `api/.dev.vars` 只用于本地 Wrangler 开发，不应提交到仓库
- 当前示例里最少需要 `RUN_TOKEN_SECRET`
- `COOKIE_SECURE=false` 适合本地 http 联调，远端不要沿用

## 每日题库脚本

- 默认行为：`npm run challenge:sql`
	- 直接把当天 100 条内容的 SQL 打到标准输出
- 预览当天题库：`npm run challenge:preview -- --date 2026-05-11`
- 指定日期：`npm run challenge:sql -- --date 2026-05-11`
- 输出到文件：`npm run challenge:sql -- --date 2026-05-11 --out ../.local/daily-challenge-2026-05-11.sql`
- 指定条目数：`npm run challenge:sql -- --date 2026-05-11 --count 100 --out ../.local/daily-challenge.sql`
- 一键准备本地 D1：`npm run db:bootstrap:local -- --date 2026-05-11`
- 一键准备远端 D1：`npm run db:bootstrap:remote -- --date 2026-05-11`

脚本会根据日期稳定洗牌，所以同一个日期多次生成的 100 条内容顺序一致。

## 环境变量

- `ALLOWED_ORIGIN`：允许访问 API 的前端来源，生产环境不要留空
- `RUN_TOKEN_SECRET`：run token 的签名密钥，必须使用 secret 注入，不要写入源码
- `COOKIE_SECURE`：本地开发若走 http，可临时设为 `false`
- `HARD_CPS_LIMIT`：硬拒绝字速阈值
- `RUN_START_LIMIT_MAX`：单玩家近窗内允许的 `run start` 最大次数，默认 5
- `RUN_START_LIMIT_WINDOW_MS`：单玩家 `run start` 限流窗口，默认 60000ms
- `RUN_START_IP_LIMIT_MAX`：单 IP 近窗内允许的 `run start` 最大次数，默认 12
- `RUN_START_IP_LIMIT_WINDOW_MS`：单 IP `run start` 限流窗口，默认 60000ms
- `SUSPICIOUS_COMPLETION_LIMIT_MAX`：单玩家短窗口内允许的非拒绝完成次数阈值，默认 4
- `SUSPICIOUS_COMPLETION_LIMIT_WINDOW_MS`：短时完成频率的检测窗口，默认 15000ms
- `SUSPICIOUS_CPS_LIMIT`：可疑字速阈值
- `SUSPICIOUS_SAMPLE_VARIANCE_MIN`：输入间隔过于平滑时的可疑阈值
- `RUN_TOKEN_TTL_MS`：run token 过期时间，默认 300000ms
- `SERVER_FLOOR_TOLERANCE_MS`：服务端下限耗时容差

当前约束：

- `validationStatus = suspicious` 的成绩会保留给玩家本地反馈，并允许继续推进挑战进度。
- `validationStatus = suspicious` 的成绩不会更新 `daily_best_cps`、`best_cps`，也不会进入对应排行。
- 当前 `suspicious` 触发源已覆盖：可疑字速、过于平滑的输入样本、过高的短时完成频率。
- `POST /v1/runs/complete` 现在会显式返回 `leaderboardEligible`，用于告诉前端本次成绩是否具备榜单资格，而不必仅靠 `validationStatus` 推断。

## 当前限制

- 当前不会自动按天写入挑战内容，仍需要通过 CLI 生成 SQL 并执行到 D1
- 若数据库里还没有当天挑战，`GET /v1/challenge/today` 会返回 404