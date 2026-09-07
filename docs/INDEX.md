# Poetic Typewriter 文档索引

## 当前部署方向（2026-09-07 更新）

- 在用户已明确提供腾讯云轻服务器背景并要求“基于现有服务器制定方案”的前提下，会话中错误地将在线化实施路线推进为 Cloudflare Worker + D1。
- 该行为违背了已知基础设施约束，属于重大决策失误，不得被解释为普通技术分歧或默认优化。
- 当前有效偏好：用户进一步了解后倾向采用 Cloudflare 方案，已撤销此前否决约束；后续以 Cloudflare 为优先规划方向，具体上线细节待完善。
- 目标主站域名：`game.onovich.com`（用户于 2026-09-07 指定），不使用 `blog.onovich.com`；这是部署目标，尚不代表 DNS 或生产绑定已完成。
- 用户已确认保留现有游戏与工具门户，项目部署于 `https://game.onovich.com/PoeticTypewriter/`。生产使用精确子路径 Workers Routes，不接管根域名首页。
- 仍须尊重用户明确的基础设施偏好，不得擅自替换方向；本次表态已足以更新 Cloudflare 方向，无需重复确认该偏好。上述历史教训仍保留。

## 全局知识库

通用知识见 D:\AI\Claude\GlobalDocs，项目接入说明见 `GLOBAL_DOCS_REFERENCE.md`。

## 本地文档列表

- `CLOUDFLARE_DEPLOYMENT.md`：2026-09-07 本地验收结果、发布命令、账号与域名阻塞点。

- `PROJECT_KNOWLEDGE.md`：项目定位、架构边界、交互基线、视觉基线、部署事实、风险与扩展方向。
- `ONLINE_COMPETITION_ARCHITECTURE.md`：Cloudflare 架构草案，恢复为当前优先方向的规划基础，实施前需核对现状。
- `SESSION_NOTES_2026-05-08.md`：本次初始化与重构会话中的经验、教训、复盘，以及这次重大决策失误的显式记录。
- `GLOBAL_DOCS_REFERENCE.md`：本项目与全局知识库的关系、引用原则和使用方式。

## 已记录待办

- 基于现有 Worker + D1 实现，评估并完善 Cloudflare 在线挑战后端与部署方案；原腾讯云优先及月底重规划待办已被取代。

## 阅读顺序建议

1. 先读 `PROJECT_KNOWLEDGE.md`，快速建立对项目现状的整体认识。
2. 再读 `SESSION_NOTES_2026-05-08.md`，了解最近一次关键会话沉淀下来的经验、判断，以及这次重大决策失误的复盘。
3. 若继续规划 Cloudflare 方案，再读 `ONLINE_COMPETITION_ARCHITECTURE.md`，并核对草案与当前实现的差异。
4. 若需要通用工作流或方法论，再看 `GLOBAL_DOCS_REFERENCE.md` 并跳转到全局知识库。
