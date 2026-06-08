<div align="center">

# Flacko的取景框 🔭

**个人 AI 知识站点 · 自动追踪热点 · RAG 智能推荐开源项目**

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

### 🔥 AI 热点追踪

自动聚合 **7 个数据源**（GitHub Trending · Hacker News · Reddit · ArXiv · RSS 等），LLM 双维度评分（前沿性 × 信息含量），OR 门筛选，时间线式展示。GitHub Actions 每 12 小时全自动运行——爬取、评分、去重、部署，零人工干预。

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
| `/` | 每日一言 + 星空/极光可交互背景 |
| `/changelog` | 版本时间线 + 顶部公告横幅 |
| `/about` | 关于作者 |

## 架构

```
                    ┌────────── 线下管道 ──────────┐
                    │                               │
  fetch_trending.py │  7 源爬取 → LLM 评分 → JSON   │ build_rag_index.py
  (每 12h, CI 定时)  │  → commit → Vercel 自动部署   │ (手动触发, 直写 Supabase)
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
├── public/                          # 静态数据（CI 自动更新）
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
│   │   ├── trending/ changelog/ about/
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

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 |
| 设计 | 暗色主题 + 玻璃拟态（Glassmorphism）设计系统 |
| 向量数据库 | Supabase pgvector — HNSW 索引 + RPC 余弦检索 |
| LLM | 智谱 GLM-4.7（评分/对话）· Embedding-3（512d 向量化） |
| 数据管道 | Python · asyncio + httpx · feedparser |
| 部署 | Vercel（main 分支自动构建）|
| CI/CD | GitHub Actions（每 12h 热点更新 + 手动 RAG 索引重建）|

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
- 启用 RLS + SELECT 策略

</details>

## 路线图

### 已完成 ✅

- [x] AI 热点追踪：7 源并发爬取 + OR 门评分 + 时间线展示
- [x] AI 项目导航「万象索骥」：RAG + 双模式对话 + 可视化卡片
- [x] 更新公告系统：横幅 + 时间线
- [x] 首页：每日一言 + 星空/极光交互背景
- [x] 全自动 CI/CD：GitHub Actions 每 12h 更新热点
- [x] RAG 存储迁移：本地 39MB JSON → Supabase pgvector
- [x] API 稳定性：429 限流感知 + 指数退避重试 + 流中断保护 + 空响应兜底
- [x] API Key 职责分离：Embedding / RAG / Trending 三份独立 Key

### 进行中 / 计划中 🚧

- [ ] **RAG 架构升级**：MCP 协议 + ReAct 推理循环
- [ ] **嵌入数据集扩充**：增加项目覆盖面，引入更多数据源
- [ ] **项目选取策略优化**：关注每周新增 star 数（增长趋势而非绝对值）
- [ ] 移动端体验优化
- [ ] 暗色/亮色主题切换
- [ ] 自定义站点 Logo

## License

[MIT](LICENSE)

---

<div align="center">
Built with ❤️ by <a href="https://flackoye.bond">Flacko</a>
</div>
