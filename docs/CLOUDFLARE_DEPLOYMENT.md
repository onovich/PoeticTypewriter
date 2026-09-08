# Cloudflare 部署准备与验收（2026-09-07）

本地与真实 staging 浏览器流程已验证，staging 和 production Worker、D1 数据库均已部署。用户已开启 `game` DNS 代理，正式地址已上线并通过浏览器验收；GitHub 手动部署工作流需要另行配置 Environment Secrets。

## 已完成

- `api/wrangler.cloudflare.jsonc` 将静态前端和 API 交给同一个 Worker；`/PoeticTypewriter/v1/...` 与 `/PoeticTypewriter/health` 优先进入 API，其余项目内请求由静态资源处理。
- 本地、staging、production 使用不同数据库名称与 ID 配置。远端数据库实际 ID 已写入配置，两库均已应用全部 3 个迁移；发布脚本拒绝占位 ID。
- `npm run build:cloudflare` 构建 `dist-cloudflare/PoeticTypewriter/`，预览与生产都使用 `/PoeticTypewriter/` 子路径及同域 API；普通 `npm run build` 继续支持原 GitHub Pages 构建。
- 当天首次 API 访问会生成 10 条题目。沿用原有 UTC 日期边界（北京时间 08:00 换日）与确定性题库，同日不重生成。事务内分组插入，每组不超过 98 个绑定参数。
- 修复异步 handler 未 await 导致异常绕过 API 错误处理的问题。异常 JSON 返回 400；错误 Cookie 和畸形签名令牌不会导致未处理异常。
- API 响应禁止缓存；新同域入口拒绝外站 Origin，生产 Cookie 保留 Secure、HttpOnly、SameSite=Lax。
- 修复统计面板覆盖题目，将二者放入正常文档流；保留自由模式原有上方留白。
- 增加 API 依赖锁文件、隔离预览发布入口和手动触发的 `.github/workflows/cloudflare.yml`。

## 已验证结果

| 检查 | 结果 |
| --- | --- |
| 原 Vite 构建、API 模块导入 | 通过 |
| staging / production Wrangler dry-run | 通过；仅打包检查，不代表远端绑定存在 |
| Wrangler runtime types | 已成功生成到忽略目录 `.local/` |
| API 自动化测试 | 5 项通过：D1 首次生成/并发幂等/跨日、异步错误、路由与 Origin、子路径隔离/跳转、Cookie/令牌 |
| 原 API smoke | 6 组通过：正常、可疑、拒绝、提交频率、IP 漂移、玩家/IP 限流 |
| 构建产物 + 本地 Worker 浏览器 smoke | pending、accepted、suspicious、rejected、bootstrap 失败回退均通过 |
| 原 Worker + Vite 浏览器 smoke | 同样的 4 类结果通过，保留原开发路径 |
| 桌面 1440×900、手机竖屏 390×844 | 统计不遮挡题目、题目不遮挡键盘、无横向溢出、自由模式真实键盘输入通过 |
| 已确认的子路径版本复测 | 浏览器流程、静态资源、Cookie Path、无尾斜杠 308 跳转、根路径及相似路径隔离全部通过；两个环境的发布脚本 dry-run 通过 |

截图在 `.local/screenshots/`（忽略文件，不提交）。浏览器烟测会自行启动并关闭本地服务。手机横屏、真实移动设备和生产网络延迟仍需上线前验收；这轮没有做压力测试或并发成绩提交的原子性专项测试。

## 远端部署结果

- Staging：`https://poetic-typewriter-staging.onovich1110.workers.dev/PoeticTypewriter/`，版本 `b25cd134-4e3e-4e11-82a6-3d853577beba`。
- Staging D1：`158c8d4c-78bf-4e80-97f6-7ac0a369b492`。
- Production Worker：`poetic-typewriter`，版本 `d501cabe-556d-4b20-939c-8360741b154f`，关闭 workers.dev。
- Production D1：`7cf4511c-9da0-441e-9f38-f000ed0f64bd`。
- 已通过 API 确认生产仅绑定 `game.onovich.com/PoeticTypewriter` 与 `game.onovich.com/PoeticTypewriter/*` 两条路由，门户首页保留。
- 真实 staging HTTPS 浏览器 smoke 全通过：pending、accepted、suspicious、rejected、失败回退、Cookie 作用域、308 跳转、路径隔离、桌面及手机竖屏布局、自由模式键盘输入。日志位于 `.local/staging-browser-smoke.log`。测试成绩仅写 staging。
- 本机测试经现有代理 `http://127.0.0.1:7897` 访问 staging；测试脚本使用 `POETIC_TYPEWRITER_TEST_PROXY` 同时配置 Node HTTP 和 Chromium，未关闭 TLS 校验。
- 两环境签名密钥分别保存在忽略目录 `.local/credentials/`，部署助手 `.local/deployEnvironment.mjs` 复用已有密钥；临时上传密钥文件在部署结束后删除。

## 正式域名验收完成

2026-09-07 用户已将 `game` CNAME 开启橙云，目标保持 `onovich.github.io`。正式页面、`/PoeticTypewriter/health` 与门户首页均返回 HTTP 200，经过 Cloudflare。

真实 Chromium 在 1440×900 和 390×844 两种视口通过：每日挑战加载生产 D1 题目、等待输入状态、Secure/HttpOnly/SameSite=Lax 且 Path 为 `/PoeticTypewriter/` 的 Cookie、无布局遮挡及横向溢出、自由模式键盘输入、无页面运行异常。生产未提交测试成绩；完整成绩校验流程在 staging 验证。截图位于 `.local/screenshots/production-daily-*.png`。

无尾斜杠且带查询参数的正式地址由现有 GitHub Pages 返回 301，正确保留参数并跳转至 Worker 子路径；staging 的同类请求由 Worker 返回 308。生产测试验证跳转目标，不要求两环境状态码完全一致。门户首页继续保留原内容。

此前 OAuth DNS 访问 403 和浏览器控制超时导致的人工步骤已完成，目前部署无需用户继续协助。

## 可复现的本地检查

在仓库根目录执行：

```powershell
npm ci
npm ci --prefix api
npm test --prefix api
npm run cloudflare:check
npm run smoke:cloudflare
```

本地 smoke 需要 `api/.dev.vars` 包含 `RUN_TOKEN_SECRET` 和 `COOKIE_SECURE=false`；此文件已被 Git 忽略。新环境可用 Node 的 `crypto.randomBytes(32)` 生成本地测试密钥，CI 已自动生成。不要复用生产密钥做本地测试。

## 后续重新发布

1. `cd api`，运行 `npx wrangler whoami`，核实账号与 `onovich.com` 的归属。
2. 先查询已有 D1，避免重建同名资源。为预览和生产分别准备 `poetic-typewriter-staging`、`poetic-typewriter-production` 数据库，记录实际 ID。
3. 在环境中设置 `CLOUDFLARE_ACCOUNT_ID`、对应的 `CLOUDFLARE_D1_DATABASE_ID`，以及该环境专用且持久保存的 `RUN_TOKEN_SECRET`（至少 32 字符）。本机可使用 OAuth；CI 还需要 `CLOUDFLARE_API_TOKEN`。
4. 从仓库根目录执行 `npm run deploy:cloudflare -- staging`。脚本先构建和 dry-run，再应用迁移，最后同时上传代码、资源和密钥。临时密钥文件在 `.local/` 下创建，并在完成或失败时移除；密钥不打印。
5. 对真实 `workers.dev/PoeticTypewriter/` 预览做 HTTPS、Cookie、每日挑战、排行榜和自由模式验收。
6. 核对生产 DNS 代理及现有门户，执行 `npm run deploy:cloudflare -- production`，随后验收项目子路径和门户首页。无需再次询问已确认的部署路径。

不要在每次发布时重新随机生成已有环境的签名密钥，否则未完成的 run token 会失效。脚本不替用户购买付费套餐。

## GitHub Actions

工作流仅手动触发，选择 staging 或 production；使用 `cloudflare-staging` / `cloudflare-production` GitHub Environments。每个 Environment 配置：

- Variables：`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_D1_DATABASE_ID`。
- Secrets：`CLOUDFLARE_API_TOKEN`、`RUN_TOKEN_SECRET`。

工作流先执行 API 测试与真实 Chromium smoke，通过后才部署。工作流随源码维护，GitHub Environment Secrets 尚未配置，不能直接运行远端部署。旧 GitHub Pages 工作流仍保留，迁移完成前不要直接关闭现有访问链路。

## 仍需关注的已有边界

页面已改为构建时生成 Tailwind CSS，并通过 Fontsource 将 Playfair Display 与 Special Elite 字体随站点托管（font-display: swap）。字体许可证随发布产物保留在 licenses/。轻量反作弊依赖客户端上报数据和服务端启发式校验，不代表严格可信的竞技成绩。生产网络延迟、配额与并发行为需要结合预览环境继续验证。

## 配置依据

- [Workers Static Assets 配置](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Workers Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)
- [静态资源子目录部署](https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-a-subdirectory/)
- [D1 batch 事务](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 查询与绑定参数限制](https://developers.cloudflare.com/d1/platform/limits/)

以上配合本地 Wrangler 4.129.0 schema、CLI help 和生成的 runtime types 核对。

## 加载优化（2026-09-07）

移除 head 中阻塞解析的 Tailwind Play CDN 脚本以及 Google Fonts CSS import。使用 Tailwind 3/PostCSS 扫描 src 下模板生成静态样式，保持现有 v3 类名语义；Vite 为本站字体和样式生成带 hash 的资源 URL。

完整本地浏览器回归通过，包括成绩校验、异常回退、桌面和手机竖屏布局及自由输入。线上验收额外阻止 Tailwind/Google Fonts 域名，检查不再请求这些资源。测试数据与生产分离。

安装依赖后的 npm audit 报告现有 Vite/esbuild 开发工具链有 1 项 high、1 项 moderate；建议修复涉及 Vite 大版本升级，本次不混入该迁移。生产只发布静态构建产物，不运行 Vite 开发服务器。

优化版已发布 staging 与 production。正式页面在两种视口下通过外部样式/字体域名阻断检查、每日题目加载和自由输入；门户另用 HTTP 检查确认 200 且保留 Onovich 内容。代理网络下首次复测总等待约 8.1 秒，其中 HTML 首字节已占 7.0 秒；同浏览器二次访问约 0.92 秒。此前相同测量脚本为 13.16 / 2.84 秒，但样本少且网络波动明显，不能把差值全归因于代码。资源记录确认不再请求 Tailwind CDN / Google Fonts，字体全部来自本站。

同网络第二轮独立浏览器复测为首次 1.77 秒、再次 0.90 秒，进一步说明首次连接耗时存在波动。

## 字体预加载与浏览器缓存（2026-09-07）

HTML 预加载两款首屏 WOFF2 字体，Vite 自动转换为与 CSS 相同的哈希 URL，避免重复下载。Cloudflare 构建将 `config/cloudflare-headers` 放到静态资源根目录：仅 `/PoeticTypewriter/assets/*` 使用 `public, max-age=31536000, immutable`。HTML 保持 `max-age=0, must-revalidate`，API 保持 no-store。带哈希文件名随内容变化，更新不会依赖旧文件缓存过期。

新增可复用测速脚本：`node scripts/measureBrowserLoad.js <每日挑战URL>`，按需设置 `POETIC_TYPEWRITER_TEST_PROXY`。从导航提交开始等待游戏可输入状态，不等待统计脚本延迟的 DOMContentLoaded/load 事件。输出首字节、可输入、字体就绪及每个静态资源传输量；不提交成绩。

预览验证：字体与 JS/CSS 在 HTML 解析时同时请求；二次访问四个静态资源传输量均为 0，之前 JS/CSS 各有约 240ms 的缓存再验证。桌面与手机竖屏的每日挑战、Cookie、自由输入及布局均通过。网络切换/TLS 失败的辅助请求单独重测，不归因于页面实现。

此前部署状态（已由下方最终发布结果更新）：staging 版本 `3d64ad83-b892-4237-b3ed-131380b7bc5b` 已生效。生产多次在 Cloudflare API 请求阶段返回 `fetch failed`，包含直连和现有代理重试；未成功发布本轮配置，生产仍是 `12d65cb9-f41f-42c8-99a5-8d9e7e8f7948`。网络恢复后执行原生产部署入口并验证 assets 的 immutable 响应头及页面/API 的缓存边界。不存在数据库迁移或新授权需求。

## 模式切换与实时计时（2026-09-07）

顶部新增自由模式/每日挑战导航，当前模式高亮，支持键盘焦点；切换通过保留其他查询参数的模式 URL 重新加载，未完成的本句不会提交成绩。回退到自由模式时高亮同步。

每日挑战新增本句用时，读取与成绩提交共用的 TypingRunTracker 单调时钟，以 0.1 秒精度显示；首次有效字符开始，停顿与退格期间持续计时，完成停止，换题归零。输入处理忽略导航控件焦点与系统快捷键，避免切换模式时误输入。

新增计时单测（停止、退格、归零），浏览器 smoke 增加桌面/手机双向模式切换和停顿期间计时增长检查；全部通过。最初发布尝试遇到 Cloudflare API TLS 连接重置；网络切换后已完成本轮 UI 发布，最终结果如下。

## 最终发布与验收（2026-09-07）

源码 `78d5729b934c58581aa77ac9afbe1bfea4d4040c` 已推送 main，并完成预览与生产发布，包含字体预加载、哈希资源缓存、模式导航及实时计时。本节取代前文的临时网络阻塞状态。

- Staging：`7f9070dd-eb4d-4380-8cc6-25ce8db91461`。
- Production：`12196d14-cede-4273-82fb-61bb500fadd9`。
- 两环境远端迁移检查均为 No migrations to apply；复用原有数据库和持久签名密钥。
- 预览真实浏览器完整 smoke 通过：accepted、suspicious、rejected、接口失败回退、路径隔离，以及桌面/手机布局、模式切换和计时。首次运行超时，复测全部通过；完整成绩测试仅写预览库。
- 正式站在 1440×900 和 390×844 通过：每日题目加载、导航高亮、自由输入、首字符启动计时、停顿继续计时、切回归零、无布局重叠和横向溢出、无页面运行异常；截图已目视检查。
- 正式站 Cookie 保持 Secure、HttpOnly、SameSite=Lax 和 `/PoeticTypewriter/` 作用域。验收仅输入一个字符并切换模式，额外拦截成绩完成请求并确认没有尝试提交，生产未写测试成绩。
- 两环境 HTML 为 `max-age=0, must-revalidate`；哈希 JS/CSS/字体为 `max-age=31536000, immutable`；health API 为 `no-store`。没有外部 Tailwind/Google Fonts 请求。
- 正式发布输出确认仍仅绑定 `game.onovich.com/PoeticTypewriter` 和 `game.onovich.com/PoeticTypewriter/*`。门户首页浏览器返回 200 并保留 Onovich 内容。

用户切换网络后，curl 的 TLS 通道恢复但 Node 仍间歇断连。本机使用忽略目录 `.local/cfTransport.py` 的临时回环转发，仅允许官方 Cloudflare API 与 OAuth token 端点，保持上游证书校验，仅对 curl 握手失败做有限重试。现有 OAuth 已成功刷新，无重新登录或更换签名密钥。此助手并非生产依赖或持久系统代理设置；发布后关闭，临时密钥文件已自动清除。

本机证据（均已忽略）：`.local/release-staging-resumed.log`、`.local/release-production-resumed.log`、`.local/staging-browser-resumed.log`、`.local/staging-release-verification.log`、`.local/production-release-verification.log`、`.local/screenshots/production-release-390.png` 和 `production-release-1440.png`。GitHub Actions 的 Cloudflare Environment Secrets 配置状态不变。
## 全站本地化、精简面板与切换动画（2026-09-07）

新增简体中文/英文界面：右上角中/EN 手动切换，优先使用 `poetic-typewriter.locale` 本地缓存，否则采用浏览器首选语言（zh 系列使用简体中文，其余回退英文）。存储受限时仍可正常切换。覆盖导航、文档标题、键盘功能键和辅助标签、时间/速度单位、挑战进度、结果和失败提示。英文打字题目保留原文和判分规则。

每日面板精简为一条进度线和本句用时、今日最佳、今日排名三项读数，删除重复模式标题、常驻排名资格/技术状态、历史最佳和历史排名卡片。上一句速度、未计排名、拒绝或失败等必要信息只用一行提示展示。速度单位分行，保证窄屏显示大数值时不撑开布局。

模式切换改为 History API 页内切换，中间内容与语言控件各以 180ms 淡出/淡入，tab 和打字机键盘 DOM 保留。语言切换淡出全部文本及可能重排的工具栏、面板，再替换文案并淡入；固定功能键宽度，保留输入和同一计时时钟。支持浏览器前进/后退，连续切换串行执行，旧模式请求响应通过会话代次隔离，减少动态效果偏好下使用零时长过渡。字符气球坐标改为舞台相对坐标，切语言/布局变化时重测对齐。

验证：本地 Cloudflare 完整浏览器 smoke 的 accepted/suspicious/rejected、失败回退、桌面及手机输入/布局/计时均通过；新增中英 320/390/768/1024/1440px 检查，包括缓存覆盖浏览器默认、语言切换保留输入及计时、稳定键盘 DOM、后退恢复、迟到响应隔离、减少动态效果、速度数值不溢出、字符对齐和无页面异常。对应截图在 `.local/screenshots/localized-*.png`。新增语言优先级、字典键一致、存储不可用测试。
本轮已发布源码 `15a254a`：staging 版本 `81df5b48-ac4a-4f45-be9c-e5bded3fcb15`，production 版本 `3527909b-7037-4e8c-8bf9-0c0869e6e2a3`，生产 100% 流量生效。生产首次上传后的激活请求遭网络中断，经查询确认旧版本仍生效，再使用 `wrangler versions deploy` 激活已上传版本，未重复上传。

预览真实 HTTPS 完整 smoke 通过；生产中英文 320/390/768/1024/1440px、语言缓存、输入/计时保留、固定键盘、后退、旧请求隔离、减少动态效果全部通过，截图已检查。生产只输入单字符，不完成或提交成绩；测试的大速度数值只临时修改当前浏览器快照用于布局检查，不写数据库。HTML 保持重新验证，API health 为 200/no-store，JS 为 200/immutable，门户浏览器检查 200 且保留 Onovich 内容。临时上游转发已关闭，临时密钥文件已移除。

本轮证据位于此工作区忽略目录 `.local/ui-smoke-final.log`、`.local/ui-staging-smoke.log`、`.local/ui-production-activation.log`、`.local/ui-production-verification.log` 和 `.local/screenshots/production-localized/`。
## 题库与每日十句（2026-09-07）

两模式共用 `shared/poemLibrary.js` 的 415 句不重复英文短诗句（原有 140 句与新增 275 句）。所有句子只使用小写英文字母和空格，适配现有键盘；新增内容为本项目编写，不依赖在线取句服务。

每日生成默认值和两个 CLI 入口统一为 10 句，先规范化去重再按日期确定性随机抽取，同日对所有玩家保持一致，10 句内部不会重复。已持久化的旧 100 句集合保留，API 总数和可玩位置上限均为 10；完成第十句即返回空 nextItem，第十一句的开始或提交被拒绝。已有超过十句的进度在界面显示为 10/10，但原始进度、历史成绩和题目记录不删除、不改写。

自由模式每次从当天未出现的句子中随机取一句，出题即记为已出现，刷新、重开页面和来回切换模式后继续使用 `poetic-typewriter.free-deck.v1` 缓存。整库用完后重新开始不重复循环，避免循环最后一句与下一轮第一句相同。按与每日挑战相同的 UTC 日期换日（北京时间 08:00），保留一天的记录；顺序访问的同源标签页共享进度。同时瞬间出题的多个标签页受 localStorage 非事务性限制，不保证互斥分配。存储不可用时当前页面内仍不重复。

验证覆盖 366 个日期的每日十句唯一性与稳定性、415 句格式和去重、跨刷新/标签页的整库循环、换日及异常存储。真实 D1/API 测试完整提交十句，并验证旧 100 句集合停止于十句、拒绝第十一句且保留既有记录；浏览器验证自由模式完成后换句、刷新记忆和模式切换记忆。
本轮源码 `c994c55` 已推送 main 并发布：staging `a3b5d3e9-d633-4849-a9ec-dc2c3e62eda4`，production `963c2145-bb06-4c59-bcfd-cf83eaa32513`。预览完整浏览器回归通过；生产确认 1/10、自由模式完成自动换句、刷新和模式切换记忆，以及门户 200。两环境只读 D1 查询确认今天前十句 `playable_count=10` 且 `unique_count=10`，原 `stored_count=100` 保持，未删除历史题目或成绩。生产验收没有完成或提交每日挑战成绩。临时网络转发已关闭，密钥上传临时文件已清除。

证据：`.local/poems-smoke-final.log`、`.local/poems-staging-smoke.log`、`.local/poems-production-verification.log`、`.local/poems-staging-unique.log`、`.local/poems-production-unique.log`、`.local/screenshots/production-ten-poems.png`。
## 安静统计栏与固定布局（2026-09-07）

移除“正在保存成绩”和正常成功后的“上一句”提示，将最近成绩放到今日最佳之前，固定为本句用时、最近成绩、今日最佳、今日排名四列。最近成绩与今日最佳的单位始终占位，统计行固定高度；错误/可疑/拒绝/完成提示使用预留提示槽，因此状态变化不再推挤诗句或键盘。底层提交过程和校验逻辑保持。

顶部模式和语言控件改为无背景、无卡片边框的轻量文字导航，用短细线和微小圆点区分当前选择，保留 44px 点击高度与键盘焦点轮廓。统计改用更小的衬线数字、低调暖灰色、居中四列和两侧短分隔线；中英文、320–1440px 和已有淡入淡出均保留。

本地完整浏览器回归通过。新增延迟提交回归在中英 320/390/1440px 下模拟等待服务端与 1.21 字符/秒成功响应，严格比较诗句纵坐标、统计高度和键盘坐标：提交中、成功返回及异常提示出现时均与输入前一致。截图位于 `.local/screenshots/localized-*.png`，日志为 `.local/quiet-ui-smoke.log`。

本轮源码 `6fdba08` 已发布：staging `44e76283-4e85-4c9c-93cd-d37739baf846`，production `49c41b88-805c-430f-8ac7-00654b213e12`。两环境真实页面均通过延迟响应固定坐标回归，以及 390/1440px 中英文四列统计、透明导航与语言切换验收；生产门户仍返回 200 并保留 Onovich 内容。成绩接口采用浏览器模拟，没有提交真实挑战成绩。

发布与验收证据：`.local/quiet-ui-staging-deploy.log`、`.local/quiet-ui-production-deploy.log`、`.local/quiet-ui-staging-verification.log`、`.local/quiet-ui-production-verification.log`、`.local/screenshots/production-quiet-*.png`。

## SEO 基础优化（2026-09-07）

首页补齐描述性标题、随语言切换的摘要、固定生产 canonical、Open Graph / Twitter 分享信息、1200×630 PNG 和真实 WebApplication JSON-LD。初始 HTML 包含可读简介与说明链接；运行后保留语义标题及键盘右下角的轻量说明入口，后者参与语言淡入淡出，不改变统计与诗句布局。取消 viewport 禁止缩放限制。

构建生成 `/guide/en/` 与 `/guide/zh/` 静态说明页，分别有自引用 canonical、双向 hreflang 与 x-default。站点地图为 `/PoeticTypewriter/sitemap.xml`，仅列出主游戏及两篇说明，不收录模式参数副本，也不批量生成诗句薄内容。预览域静态资产附加 noindex；正式域可索引。详见 `docs/SEO.md`。

已发布 staging `40f8daff-de20-4f3c-804e-a233ba3b2efe` 与 production `61435785-4f57-4504-ae79-523fb5e1c982`。本地完整玩法与 SEO smoke 通过；最终说明入口位置在 staging 再次通过固定坐标及中英手机/桌面回归。两环境真实 HTTPS 验证无 JavaScript 内容、说明页链接、语言标记、站点地图、分享图尺寸、404 与主页面索引响应均通过。生产未提交真实挑战成绩。

门户和根 robots.txt 只读验证：门户 200，robots 允许搜索抓取；现有 Sitemap 指向门户站点地图索引，未修改根路由。项目 sitemap 已部署并通过链接暴露，但未向 Search Console 提交或确认收录，需要站点所有者账号完成该外部步骤。

证据：`.local/seo-smoke.log`、`.local/seo-staging-ui.log`、`.local/seo-staging-deploy.log`、`.local/seo-production-deploy.log`、`.local/seo-staging-verification.log`、`.local/seo-production-verification.log` 与 `.local/screenshots/seo-guide-*.png`。远程抓取检查使用 Chromium 网络栈，避免本机 Node TLS 间歇性握手失败，证书验证保持开启。

## 沉浸式视觉层级（2026-09-08）

使用统一的主文字、辅助文字、弱文字和焦点色变量；导航、统计标签及单位统一为低饱和暖灰，统计数字缩小，计时取消金色强调。诗句亮度提高并移除投影，输入字符取消发光，错误色变为柔和赭红，连线透明度降低。

键盘保留复古造型与按压反馈，机身与键帽采用更柔和的灰色渐变，降低边缘高光、双层描边和外阴影的强度。键帽增加明确的键盘焦点轮廓。固定统计高度、预留消息槽、切换动画和各视口尺寸保持。辅助文字与背景对比约 5.22:1，键帽暗端与文字对比约 5.36:1。

本地完整 Cloudflare 浏览器回归通过（含中英 320–1440px、模式和语言切换、成绩等待及返回固定坐标、自由模式出题、SEO 检查）。手机与桌面截图已人工检查；staging 线上固定坐标与中英文布局再次通过。日志 `.local/zen-ui-smoke.log`、`.local/zen-staging-verification.log`，截图沿用 `.local/screenshots/localized-*.png` 和 `staging-quiet-*.png`。

本轮发布 staging `b03c9cee-6ed5-41e8-8eb7-32228da24b0d`、production `1f0f4f28-40d6-4ea4-b768-267a990d112a`。生产中英手机与桌面、延迟提交/成功返回/异常提示的固定坐标验证均通过，门户保持 200。无真实挑战成绩提交。生产验收日志：`.local/zen-production-verification.log`。

## 预览版正式发布（2026-09-08）

用户批准上线预览分支，源码 `75be88d` 已发布为 production `2548f2ee-c271-430f-b088-2e63b2e8e20f`。包含居中书写布局、按单词换行、加载留白与淡入、个人成绩本地存档和明确的个人最佳/排名标签。无数据库迁移。原 production `1f0f4f28-40d6-4ea4-b768-267a990d112a` 保留为回撤版本，源码基线 `be0b24b`，详见 `docs/IMMERSIVE_PREVIEW.md`。

线上验证通过：2304×1278、1440、1024、390、320 视口的最长诗句/键盘边界；中英加载与减少动态效果；本地成绩刷新、换日及身份隔离；真实 API 玩家标识和十句上限；SEO 抓取、站点地图、404 和门户 200。所有成绩提交均使用浏览器模拟，没有生产成绩写入。日志 `.local/immersive-production-deploy.log`、`.local/immersive-production-verification.log`；截图 `.local/screenshots/production-approved/`。

## 连线贴合与无输入超时（2026-09-08）

连线末端采用 Canvas 字体度量计算字形底边，扣除行框空白，并随字符旋转变换端点。度量仅在创建字符和布局刷新时计算，不在每帧读取 DOM。

连续 3 分钟无有效输入时，仅重置尚未完成的本句：立即清空本句计时、失效旧请求代次和 run token；字符、连线、目标诗句淡出 180ms 后恢复同一句空输入状态。保留挑战进度和个人历史成绩，自由模式不消耗新句子。正在提交或已完成的句子不按此规则重置。后台暂停 RAF，恢复页面和处理输入之前均检查墙钟超时；无字符动画、无计时和无引擎任务时，RAF 循环停止，再次输入才唤醒。支持减少动态效果。没有新增取消接口或数据库迁移。

本地完整回归通过；新增浏览器检查覆盖自由模式真实淡出、每日挑战虚拟时钟超时、迟到 start 响应隔离、零成绩提交、恢复后全新 token、休眠时钟跳变和 RAF 停止。虚拟时钟不驱动 WAAPI 时间线，测试显式完成这部分动画，另用自由模式真实动画验证补足。两环境专项回归和固定坐标回归均通过。日志：`.local/idle-smoke-verified.log`、`.local/idle-staging-verification.log`、`.local/idle-production-verification.log`。

Staging `c1abfdf2-44b6-451e-b49c-e34af0724835`；production `b9682df1-470a-45e9-9edc-bd0840f586e2`。上一个 production `2548f2ee-c271-430f-b088-2e63b2e8e20f` 保留用于回撤。线上验证的提交接口均模拟，不产生真实成绩。

## 刷新首屏闪现修复（2026-09-08）

初始英文简介移入 noscript，游戏挂载点为空；内联背景色保证外部样式和脚本到达前保持深色空白。元数据、结构化数据和独立玩法说明页保留。

完整本地 Cloudflare 浏览器回归通过。新增启动检查主动阻塞脚本和样式，验证首屏无文字、背景正确、释放后游戏正常挂载；staging 和 production 均通过该检查及 SEO 浏览器检查。远端检查没有提交成绩。

Staging `6688e8ba-f7af-45e5-b8ed-a1b5a38cbe34`；production `cc38229e-4cf9-4950-aedc-4259358603d4`。上一生产版本 `b9682df1-470a-45e9-9edc-bd0840f586e2` 保留用于回撤。

## 每日收尾与经典诗句（2026-09-09）

完成十句后，统计行和打字目标让位于淡入的总结：十句平均速度、个人今日最快单句、与本设备上一次完整挑战的平均速度差异，以及明日更新时刻和自由模式入口。平均速度使用有效记录的总字符数除以总输入耗时，排除句间动画；只有十句有效记录齐全才显示，既有不完整历史不补造平均值。服务端个人最佳仍为权威值。

`poetic-typewriter.completions.v1` 按玩家、日期、挑战保存本地有效单句记录，刷新和模式切换恢复总结。拒绝或异常结果不进入平均值；存储不可用不影响游戏。中文提示北京时间 08:00，英文提示 00:00 UTC。

新题库含 504 条、18 位作者、41 篇作品的公版诗行，来源及规范化方法见 `docs/POEM_SOURCES.md`。界面附轻量作者和作品链接。每日新集合优先十位不同作者，保留日期确定性和句子唯一性；已有 D1 当日集合不改动。自由模式继续当天整库不重复、用尽循环。没有数据库迁移。

本地完整 Cloudflare 浏览器回归及 API 测试通过；新增检查覆盖连续十句完成、刷新恢复、320/390/1440 布局、中英切换和自由模式入口。单测覆盖加权平均、历史比较、玩家隔离、缺失与异常记录、诗行出处规范化和全年每日作者多样性。日志 `.local/completion-final-smoke.log`、`.local/completion-api-tests.log`。

Staging `b25cd134-4e3e-4e11-82a6-3d853577beba`；production `d501cabe-556d-4b20-939c-8360741b154f`。上一生产版本 `cc38229e-4cf9-4950-aedc-4259358603d4` 保留用于回撤。两环境已通过启动及总结专项检查，生产额外验证 320px 作者出处不遮挡键盘；远端所有成绩接口使用浏览器模拟，不写入真实成绩。日志 `.local/completion-staging-verification.log`、`.local/completion-production-verification.log`；截图位于 `.local/screenshots/completion-*.png` 和 `.local/screenshots/classic-poem-320.png`。
