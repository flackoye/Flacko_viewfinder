<div align="center">

# Flacko的取景框 🔭

**个人成长档案 · AI 热点追踪 · RAG 智能推荐开源项目**

[🌐 在线访问](https://flackoye.bond) · [📦 源码](https://github.com/flackoye/Flacko_viewfinder)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-pgvector-3FCF8E?logo=supabase)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

## 它能做什么

### 📷 个人成长档案

以“取景框”为视觉线索，持续记录求学经历、比赛复盘、学习札记、科研手记和阶段作品。首页负责说明这个人和这段旅程，AI 功能作为已经做出来、仍在迭代的实验保留。

### 🔥 AI 热点追踪

聚合 **12 个数据源**（GitHub Trending · Hacker News · Reddit ×5 · ArXiv ×2 · RSS ×3），LLM 双维度评分（前沿性 × 信息含量），三套 OR 门筛选（通用 / 学术论文 / 开源项目），串行限速避免 API 限流，时间线式展示。工作流支持定时运行；当前仓库的 cron 暂停，使用手动触发更新。

### 🧭 万象索骥 — AI 项目导航

基于 RAG 的开源项目智能推荐，两种交互模式：

| | 引导探索 | 自由对话 |
|:---:|------|------|
| **路径** | `/projects/explore` | `/projects/assistant` |
| **方式** | Socratic 多轮对话，逐步建立画像 | 直接描述需求，即时推荐 |
| **适合** | 不确定自己要什么的时候 | 有明确目标，想快速找到工具 |

**技术链路**：`GitHub Search → README 切块 → Embedding-3 (512d) → Supabase pgvector → HNSW 余弦检索 → GLM 流式生成 → SSE 实时输出`

### 🏠 更多内容

| 页面 | 说明 |
|------|------|
| `/` | 个人简介 + 每日一言 + 最近记录 + 可自定义照片背景 |
| `/records` | 按写作时间展示全部 Markdown 记录 |
| `/records/[...slug]` | 支持图片、公式、代码与表格的文章阅读页 |
| `/about` | 个人资料 + 标记为精选的真实经历 |
| `/changelog` | 站点版本时间线 |

## 架构

```
                    ┌────────── 线下管道 ──────────┐
                    │                               │
  fetch_trending.py │  7 源爬取 → LLM 评分 → JSON   │ build_rag_index.py
  (CI 手动/可开定时)  │  → commit → Vercel 自动部署   │ (手动触发, 直写 Supabase)
                    └────────────┬──────────────────┘
                                 │
        ┌────────────────────────┴────────────────────────┐
        ▼                                                 ▼
 ┌──────────────┐                                   ┌───────────┐
 │   Supabase   │                                   │  Vercel   │
 │  ├─ projects │  match_chunks()                    │  Next.js  │
 │  └─ chunks   │  ──HNSW 余弦──▶  Top-K            │  SSR + SSE│
 │    pgvector  │  (512d embeddings)                 └─────┬─────┘
 └──────────────┘                                         │
                                          ┌───────────────┘
                                          ▼
                                   ┌─────────────┐
                                   │  GLM 流式生成 │
                                   │  → 实时打字   │
                                   │  → 项目卡片   │
                                   └─────────────┘
```

<details>
<summary><b>📁 项目结构</b></summary>

```
├── content/                         # 个人档案配置 + Markdown 记录
├── public/                          # 静态数据与记录图片
├── scripts/
│   ├── fetch_trending.py            # 热点爬取 + LLM 评分管道
│   ├── build_rag_index.py           # RAG 索引构建 → Supabase
│   ├── github_search.py             # GitHub 项目搜索
│   └── supabase_init.sql            # Supabase 建表 + 索引 + RPC
├── src/
│   ├── app/
│   │   ├── page.tsx                 # 首页
│   │   ├── layout.tsx               # 根布局
│   │   ├── globals.css              # 玻璃拟态 + 暗色主题
│   │   ├── trending/ changelog/ about/ records/
│   │   ├── projects/                # 落地页 / 引导探索 / 自由对话
│   │   └── api/projects/            # SSE 流式 API Route
│   ├── components/                  # UI 组件（Navbar、Timeline、Chat、Card...）
│   └── lib/
│       ├── rag.ts                   # RAG 核心（Embedding + Prompt + 标签解析）
│       ├── supabase.ts              # Supabase 客户端
│       └── categories.ts            # 7 大 AI 分类定义
├── .github/workflows/               # CI/CD（热点定时更新 + RAG 索引）
└── README.md
```

</details>

---

## 技术实现详解

### 🔥 AI 热点自动追踪

**设计逻辑**：多源并发爬取 → 去重 → LLM 双维度评分（前沿性 + 信息含量）→ 分类型 OR 门筛选 → JSON 落地，CI 定时全链路自动化。

**技术要点**：
- 12 源异步爬取（GitHub / HN / Reddit×5 / ArXiv×2 / RSS×3），ArXiv 两阶段粗筛（关键词白名单 + 黑名单淘汰 ~70%）后按质量相关性选品（关键词命中 + has_code + 顶级实验室）排序取 top 20 送 LLM，避免纯按时间导致送筛质量随抓取时刻随机波动
- GitHub 初筛用精准关键词 `LLM OR GPT OR transformer`（避开宽泛的 "AI"，召回从 ~11万 降到 ~1.5万），条目 timestamp 取抓取时间而非仓库创建时间，保证在时间线与资讯同步出现
- GitHub 高星仓库（⭐≥200）绕过 LLM 直接入选——LLM 评分看不到 stars，用绝对社区热度兜底，避免爆款被主观误杀
- HackerNews 高赞热点（🔥≥100 赞）绕过 LLM 直通——外链帖正文在外部网站拿不到，用社区热度兜底
- GLM-4.7 评分，5 级锚定 + few-shot 约束漂移；三套 OR 门（通用 ≥80/80/60、ArXiv ≥70/70/65、开源 ≥60/60/50）适配不同内容特征
- 串行评分 + 6s 间隔控制账户级 RPM，429 退避 15→60s

**待改进**：无评分质量监控（漂移不可见）；GitHub 高星项目仍可能被 LLM 主观评分误杀（stars 未进 prompt）；单 LLM 评分无交叉验证

### 🧭 万象索骥 — RAG 项目导航

**设计逻辑**：离线构建向量索引（README 切块 → Embedding → pgvector），在线检索 Top-K 片段注入 Prompt，SSE 流式输出，支持引导 / 助手双模式。

**技术要点**：
- Embedding-3 (512d) + Supabase pgvector HNSW 索引，余弦距离 Top-5 检索
- SSE 多类型事件流（chunk / options / suggestions / projects / done），Prompt 用 `<project>` 标签触发前端卡片渲染
- 429/5xx 指数退避 + 流中断保护，已有文本保留展示

**待改进**：本地快照约 150 个项目；无增量更新机制，每次全量重建；对话无记忆持久化

### 🎨 前端

**设计逻辑**：Next.js 16 App Router + Tailwind v4，暗色玻璃拟态风格，CSS 变量驱动主题，用户可通过 Customizer 调整背景和透明度。

**技术要点**：
- Tailwind v4 `@theme inline` 定义设计 Token，玻璃拟态 `backdrop-filter: blur(16px) saturate(1.2)`
- SettingsProvider (React Context) + localStorage 持久化用户配置
- 首页 SSR 获取每日一言，Canvas 星空 / 极光交互背景

**待改进**：需补真实移动设备性能走查；无亮色阅读主题；尚未形成完整的自动化无障碍测试

---

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 |
| 设计 | 暗色主题 + 玻璃拟态（Glassmorphism）设计系统 |
| 向量数据库 | Supabase pgvector — HNSW 索引 + RPC 余弦检索 |
| LLM | 智谱 GLM-4.7（评分/对话）· Embedding-3（512d 向量化） |
| 数据管道 | Python · asyncio + httpx · feedparser |
| 部署 | Vercel（main 分支自动构建）|
| CI/CD | GitHub Actions（热点手动更新，可恢复每 12h cron；RAG 索引手动重建）|

## 本地运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行热点管道（需要 ZHIPU_TRENDING_API_KEY）
.venv/Scripts/python.exe scripts/fetch_trending.py

# 重建 RAG 索引（需要 ZHIPU_API_KEY + GITHUB_TOKEN + SUPABASE_*）
PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -u scripts/build_rag_index.py
```

<details>
<summary><b>🔧 环境变量</b></summary>

复制 `.env.example` 为 `.env`，填写以下变量：

| 变量 | 用途 | 必需 |
|------|------|:---:|
| `ZHIPU_API_KEY` | Embedding（用户提问向量化 + 索引构建）| ✅ |
| `ZHIPU_RAG_API_KEY` | RAG 对话生成（GLM-4.7）| ✅ |
| `ZHIPU_TRENDING_API_KEY` | 热点评分（GLM-4.7）| ✅ |
| `GITHUB_TOKEN` | GitHub API 项目搜索 | ✅ |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role Key | ✅ |
| `ZHIPU_MODEL` | 自定义 GLM 模型（默认 `glm-4.7`）| 可选 |

**获取方式**：
- 智谱 API Key → [open.bigmodel.cn](https://open.bigmodel.cn)
- GitHub Token → Settings → Developer settings → Personal access tokens
- Supabase → [supabase.com](https://supabase.com) 创建项目后获取

</details>

<details>
<summary><b>🗄️ Supabase 初始化</b></summary>

在 Supabase SQL Editor 中执行 [`scripts/supabase_init.sql`](scripts/supabase_init.sql)：

- 创建 `projects` 表（项目元数据）
- 创建 `embedding_chunks` 表（512 维向量 + HNSW 索引）
- 创建 `match_chunks()` RPC 函数（余弦距离 Top-K 检索）
- 启用 RLS；线上读取只经过服务端 service role，不开放 anon 直读原始语料

</details>

## 路线图

更完整的接口契约与演进建议见：[`docs/API.md`](docs/API.md) · [`docs/IMPROVEMENT_ROADMAP.md`](docs/IMPROVEMENT_ROADMAP.md)。

### 已完成 ✅

- [x] AI 热点追踪：7 源并发爬取 + OR 门评分 + 时间线展示
- [x] AI 项目导航「万象索骥」：RAG + 双模式对话 + 可视化卡片
- [x] 更新公告系统：横幅 + 时间线
- [x] 首页：每日一言 + 星空/极光交互背景
- [x] CI/CD 管道：GitHub Actions 手动更新热点，可按需恢复每 12h cron
- [x] RAG 存储迁移：本地 39MB JSON → Supabase pgvector
- [x] API 稳定性：429 限流感知 + 指数退避重试 + 流中断保护 + 空响应兜底
- [x] API Key 职责分离：Embedding / RAG / Trending 三份独立 Key
- [x] LLM 评分降速 + 开源门槛放宽：串行限速控制 RPM + GitHub 高星仓库专用宽松门
- [x] GitHub 源优化：精准 query（去 "AI" 避宽泛匹配）+ timestamp 改抓取时间（解决时间线沉底）+ 保留窗口 5→7 天
- [x] 筛选可观测性 + ArXiv 选品：淘汰条目打印 F/S 分数（告别黑箱）+ 粗筛按质量相关性选品（根治 CI 偶发 0 通过）
- [x] 取景框视觉系统：相机光圈转场 + 分页面氛围背景 + 减少动态效果偏好支持
- [x] 个人档案改为真实经历驱动，不预设技术栈和内容分类
- [x] Markdown 记录系统：图片、KaTeX 公式、代码高亮、表格与复制代码

### 进行中 / 计划中 🚧

- [ ] **RAG 架构升级**：MCP 协议 + ReAct 推理循环
- [ ] **嵌入数据集扩充**：增加项目覆盖面，引入更多数据源
- [ ] **项目选取策略优化**：关注每周新增 star 数（增长趋势而非绝对值）
- [ ] 带站内引用的个人内容 LLM 向导
- [ ] 真实移动设备性能与交互走查
- [ ] 暗色/亮色主题切换
- [ ] 自定义站点 Logo

## License

[MIT](LICENSE)

---

<div align="center">
Built with ❤️ by <a href="https://flackoye.bond">Flacko</a>
</div>
