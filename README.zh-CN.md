# PoeticTypewriter

[English](README.md)

拟物打字机互动作品，把输入手感、诗句和漂浮气球结合起来。

![PoeticTypewriter 封面](docs/cover.png)

## 项目包含什么

- 拟物键盘。
- 漂浮气球。
- 每日挑战。

## 快速开始

安装依赖并启动本地版本：

```bash
npm install
npm run dev
```

仓库还提供 `npm run build`。

## 仓库结构

- `src/` — 应用与库的源代码。
- `scripts/` — 运行时或自动化脚本。
- `docs/` — 项目文档与设计说明。
- `origin/` — 原始原型与设计资料。
- `.github` — 自动化与 GitHub Pages 工作流。

## 部署

访问[自由模式](https://game.onovich.com/PoeticTypewriter/?mode=free)或[每日挑战](https://game.onovich.com/PoeticTypewriter/?mode=daily)。样式与字体已随站点托管，原游戏门户保留。详见[部署说明](docs/CLOUDFLARE_DEPLOYMENT.md)。

## 文档

- [`docs/ONLINE_COMPETITION_ARCHITECTURE.md`](docs/ONLINE_COMPETITION_ARCHITECTURE.md)
- [`docs/PROJECT_KNOWLEDGE.md`](docs/PROJECT_KNOWLEDGE.md)
- [`origin/design.md`](origin/design.md)
- [`docs/GLOBAL_DOCS_REFERENCE.md`](docs/GLOBAL_DOCS_REFERENCE.md)
- [`docs/INDEX.md`](docs/INDEX.md)

## 当前状态

正式站已上线。API 测试：`npm test --prefix api`；浏览器回归：`npm run smoke:cloudflare`。

## 许可证

当前仓库未包含项目整体开源许可证，字体许可证保留在 `public/licenses/`。
