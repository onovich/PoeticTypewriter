# Poetic Typewriter 文档索引

## 重大决策失误公示（必须先读）

- 在用户已明确提供腾讯云轻服务器背景并要求“基于现有服务器制定方案”的前提下，会话中错误地将在线化实施路线推进为 Cloudflare Worker + D1。
- 该行为违背了已知基础设施约束，属于重大决策失误，不得被解释为普通技术分歧或默认优化。
- 当前有效决策：不采用 Cloudflare 作为正式方案；若继续在线化，月底再基于腾讯云轻服务器重新规划和实施。
- 强制约束：今后凡涉及部署、托管、数据库和运维形态的建议，必须先确认用户已有基础设施约束，再给出技术方案，不得擅自替换基础设施方向。

## 全局知识库

通用知识见 D:\AI\Claude\GlobalDocs，项目接入说明见 `GLOBAL_DOCS_REFERENCE.md`。

## 本地文档列表

- `PROJECT_KNOWLEDGE.md`：项目定位、架构边界、交互基线、视觉基线、部署事实、风险与扩展方向。
- `ONLINE_COMPETITION_ARCHITECTURE.md`：Cloudflare 托管探索稿，现已被否决，仅作留档与复盘，不是当前执行方案。
- `SESSION_NOTES_2026-05-08.md`：本次初始化与重构会话中的经验、教训、复盘，以及这次重大决策失误的显式记录。
- `GLOBAL_DOCS_REFERENCE.md`：本项目与全局知识库的关系、引用原则和使用方式。

## 已记录待办

- 月底再基于腾讯云轻服务器重新规划在线挑战后端与部署方案。

## 阅读顺序建议

1. 先读 `PROJECT_KNOWLEDGE.md`，快速建立对项目现状的整体认识。
2. 再读 `SESSION_NOTES_2026-05-08.md`，了解最近一次关键会话沉淀下来的经验、判断，以及这次重大决策失误的复盘。
3. 若需要查看被否决的 Cloudflare 探索稿，再读 `ONLINE_COMPETITION_ARCHITECTURE.md`，但不要把它当作当前执行方案。
4. 若需要通用工作流或方法论，再看 `GLOBAL_DOCS_REFERENCE.md` 并跳转到全局知识库。