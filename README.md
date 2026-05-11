# Poetic Typewriter
Poetic Typewriter is a skeuomorphic typing toy rebuilt from a single-file prototype into a modular Vite project, preserving the original mood, keyboard feel, and floating-balloon poem interaction.<br/>**Poetic Typewriter 是一个从单文件原型整理而来的拟物化打字作品，现已重组为模块化 Vite 工程，同时保留了原始的氛围感、按键手感与气球诗句交互。**
## Overview
- The current repository now has a runnable frontend entry with `index.html`, `src/main.js`, `src/App.js`, and verified Vite scripts.<br/>**当前仓库已经具备可运行的前端入口，包括 `index.html`、`src/main.js`、`src/App.js` 以及已验证的 Vite 脚本。**
- The codebase is organized into `src/data`, `src/logic/engine`, `src/logic/hooks`, `src/view/screens`, and `src/view/components` to prepare future migration and maintenance work.<br/>**代码库已按 `src/data`、`src/logic/engine`、`src/logic/hooks`、`src/view/screens`、`src/view/components` 分层，便于后续迁移与维护。**
- Pure poem data, keyboard layout, timings, and phase constants live in the data layer, while animation state progression and balloon physics live in the engine layer.<br/>**诗句数据、键盘布局、时序参数和状态常量已放入数据层，动画推进与气球物理则位于 engine 逻辑层。**
- The UI layer currently keeps the original DOM-driven rendering to reduce rewrite risk, so this is an architecture-ready refactor rather than a full framework migration.<br/>**当前 UI 层仍保留原型的 DOM 驱动渲染方式，以降低重写风险，因此这次交付属于“已建立架构迁移基础”，而不是完整的框架迁移。**
- The frontend runtime now supports both free mode and a CLI-friendly daily challenge mode bootstrap, with the online mode wired through a dedicated API client instead of the animation engine.<br/>**当前前端运行时已经支持自由模式和适合 CLI 联调的每日挑战模式启动路径，在线模式通过独立 API 客户端接入，而不是直接塞进动画引擎。**
## Features
- Physical and on-screen keyboard input both drive the same animation engine.<br/>**物理键盘与屏幕虚拟键盘共用同一套动画引擎。**
- Correct and incorrect letters rise from the paper slot with elastic SVG strings and independent motion states.<br/>**正确与错误字符都会从出纸口升起，并带有弹性 SVG 细线和独立运动状态。**
- Completed poems wait, retract, hover, and blow away in sequence before the next line loads.<br/>**整句完成后会按等待、收线、悬浮、吹散的顺序演出，然后再加载下一句。**
- The original single-file prototype remains in `origin/` as a rollback reference.<br/>**原始单文件原型仍保留在 `origin/` 目录中，可作为回填参考。**
## Commands
- Install dependencies with `npm install`.<br/>**使用 `npm install` 安装依赖。**
- Start local development with `npm run dev`.<br/>**使用 `npm run dev` 启动本地开发。**
- Build the production bundle with `npm run build`.<br/>**使用 `npm run build` 构建生产版本。**
- Preview the built site locally with `npm run preview`.<br/>**使用 `npm run preview` 本地预览构建产物。**

## Runtime Modes
- Free mode remains the default local experience and continues to use the bundled poem list.<br/>**自由模式仍然是默认本地体验，并继续使用前端内置的诗句列表。**
- Daily challenge mode is enabled by visiting `?mode=daily-challenge` or `?mode=daily`, and it expects a public API base URL in `VITE_API_BASE_URL`.<br/>**每日挑战模式可通过访问 `?mode=daily-challenge` 或 `?mode=daily` 启用，并要求在 `VITE_API_BASE_URL` 中提供公开 API 地址。**
- Public frontend env vars belong in `.env.local`; see `.env.example` for the supported keys.<br/>**前端公开环境变量应放在 `.env.local` 中；支持的键见 `.env.example`。**
- At runtime, a debug bridge is exposed as `window.__POETIC_TYPEWRITER__`, which surfaces the current mode and challenge snapshot for CLI or DevTools inspection.<br/>**运行时会暴露 `window.__POETIC_TYPEWRITER__` 调试桥，可用于在 CLI 或 DevTools 中查看当前模式和挑战快照。**
- Daily mode also updates `document.title` with progress and recent result, and it can emit compact runtime logs when `VITE_ENABLE_RUNTIME_LOGS=true`.<br/>**每日挑战模式还会用 `document.title` 反映当前进度与最近成绩，并可在 `VITE_ENABLE_RUNTIME_LOGS=true` 时输出精简运行时日志。**
- Daily mode now renders an in-page stats panel for recent CPS, daily best, all-time best, and both ranks, with status copy for accepted, suspicious, and rejected runs.<br/>**每日挑战模式现在还会在页面内直接显示最近字速、当日最佳、历史最佳和两个排名，并针对 accepted、suspicious、rejected 三种结果给出状态提示。**
## Deployment
- GitHub Pages deployment is prepared with `.github/workflows/deploy.yml` and Vite `base: '/PoeticTypewriter/'`.<br/>**GitHub Pages 部署已通过 `.github/workflows/deploy.yml` 和 Vite 的 `base: '/PoeticTypewriter/'` 配置完成准备。**
- In the GitHub repository settings, switch `Settings -> Pages -> Source` to `GitHub Actions` before the first production deployment.<br/>**首次正式部署前，请在 GitHub 仓库中将 `Settings -> Pages -> Source` 切换为 `GitHub Actions`。**
## Documentation
- Internal project notes are indexed in `docs/INDEX.md`.<br/>**项目内部文档入口整理在 `docs/INDEX.md`。**
- Long-lived project knowledge is recorded in `docs/PROJECT_KNOWLEDGE.md`.<br/>**项目长期认知记录在 `docs/PROJECT_KNOWLEDGE.md`。**
- Session lessons and refactor notes are recorded in `docs/SESSION_NOTES_2026-05-08.md`.<br/>**本次会话中的经验、教训和重构思考记录在 `docs/SESSION_NOTES_2026-05-08.md`。**
- Global reusable workflow and methodology references are described in `docs/GLOBAL_DOCS_REFERENCE.md`.<br/>**可复用的全局工作流与方法论引用方式见 `docs/GLOBAL_DOCS_REFERENCE.md`。**