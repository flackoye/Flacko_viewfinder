<div align="center">

# Flacko的取景框 🔭

**个人知识站点 · 面向所有关注 AI 的计算机从业者**

[🌐 flackoye.bond](https://flackoye.bond) · [📦 GitHub](https://github.com/flackoye/Flacko_viewfinder)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-pgvector-3FCF8E?logo=supabase)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel)

</div>

---

## ✨ 这是什么

一个以 AI 为核心的个人知识管理与导航平台。自动追踪 AI 行业热点、用 RAG 帮你发现优质开源项目，全部自动化运行——数据采集、评分、索引、部署，零人工干预。

## 🎯 功能概览

### 🔥 AI 热点追踪 — `/trending`

自动聚合 7 个数据源（GitHub Trending · Hacker News · Reddit · RSS 等），GLM 双维度评分（前沿性 × 信息含量），OR 门筛选 + 时间线式展示。GitHub Actions 每 12 小时自动运行。

### 🧭 万象索骥 — `/projects`

基于 RAG 的 AI 开源项目推荐系统，两种交互模式：

| 模式 | 路径 | 说明 |
|:---:|------|------|
| 🎓 引导探索 | `/projects/explore` | Socratic 式多轮对话，逐步建立画像后精准推荐 |
| 💬 自由对话 | `/projects/assistant` | 直接描述需求，即时推荐匹配项目 |

技术链路：`GitHub Search API → README 切块 → Embedding-3 (512d) → Supabase pgvector → RPC 余弦检索 → GLM 流式生成`

### 🏠 其他页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/` | 每日一言 + 星空 / 极光可交互背景 |
| 更新日志 | `/changelog` | 版本时间线 + 顶部公告横幅 |
| 关于 | `/about` | 个人信息、技术栈、收藏网址 |

## 🏗️ 架构

```
                        ┌──────── 线下管道 ────────┐
                        │                          │
  fetch_trending.py     │  7 源爬取 → 评分 → JSON  │  build_rag_index.py
  (每 12h, GitHub Actions)│  → commit → Vercel 部署 │  (定时, 直写 Supabase)
                        └──────────┬───────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                                                 ▼
   ┌──────────────┐                                   ┌───────────┐
   │  Supabase    │  match_chunks()                   │  Vercel   │
   │  ├─ projects │  ──余弦距离──▶  Top-K chunks      │  Next.js  │
   │  └─ chunks   │  (HNSW 索引, 512d)                │  SSR + SSE│
   │    pgvector  │                                   └─────┬─────┘
   └──────────────┘                                         │
                                          ┌─────────────────┘
                                          ▼
                                   ┌─────────────┐
                                   │  GLM 流式生成 │
                                   │  → 实时打字   │
                                   │  → 项目卡片   │
                                   └─────────────┘
```

<details>
<summary>📁 项目结构</summary>

```
├── public/                          # 静态数据（CI 自动更新）
├── scripts/
│   ├── fetch_trending.py            # 热点爬取 + LLM 评分
│   ├── build_rag_index.py           # RAG 索引 → Supabase
│   └── github_search.py             # GitHub 项目搜索
├── src/
│   ├── app/
│   │   ├── page.tsx                 # 首页
│   │   ├── layout.tsx               # 根布局
│   │   ├── globals.css              # 玻璃拟态 + 暗色主题
│   │   ├── trending/ changelog/ about/
│   │   ├── projects/                # 落地页 / 引导 / 助手
│   │   └── api/projects/            # SSE 流式 API
│   ├── components/                  # UI 组件
│   └── lib/
│       ├── rag.ts                   # RAG 核心（Embedding + Prompt + 解析）
│       ├── supabase.ts              # Supabase 客户端
│       └── categories.ts            # 分类定义
├── .github/workflows/               # CI/CD
├── CLAUDE.md                        # Claude Code 上下文
└── README.md
```

</details>

## 🛠️ 技术栈

| 层 | 选型 |
|------|------|
| 框架 | Next.js 16 + React 19 + TypeScript |
| 样式 | Tailwind CSS v4 — 暗色主题 + 玻璃拟态设计系统 |
| 向量数据库 | Supabase pgvector — HNSW 索引 + RPC 检索 |
| LLM | 智谱 GLM-4.7-Flash（评分 / 对话）+ Embedding-3（512d 向量） |
| 数据管道 | Python 异步爬取 + LLM 评分 + RAG 索引 |
| 部署 | Vercel（main 分支自动构建）|
| CI/CD | GitHub Actions（每 12h 热点更新 + RAG 索引重建）|

## 🚀 本地开发

```bash
# 前端
npm install && npm run dev

# 热点管道（需 ZHIPU_API_KEY）
.venv/Scripts/python.exe scripts/fetch_trending.py

# 重建 RAG 索引（需 ZHIPU_API_KEY + GITHUB_TOKEN + SUPABASE_*）
PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -u scripts/build_rag_index.py
```

### 环境变量

| 变量 | 用途 | 必需 |
|------|------|:---:|
| `ZHIPU_API_KEY` | 智谱 AI（评分 / 对话 / Embedding）| ✅ |
| `GITHUB_TOKEN` | GitHub API（项目搜索）| ✅ |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role Key | ✅ |
| `ZHIPU_MODEL` | 自定义模型名（默认 `glm-4.7-flash`）| 可选 |

## 📋 路线图

### 已完成 ✅

- [x] AI 热点追踪：7 源并发爬取 + OR 门评分 + 时间线展示
- [x] AI 项目导航「万象索骥」：RAG + 双模式对话 + 可视化卡片
- [x] 更新公告系统：横幅 + 时间线
- [x] 首页：每日一言 + 星空/极光交互背景
- [x] 全自动 CI/CD：GitHub Actions 每 12h 更新热点
- [x] API 重试机制：指数退避 + 前端重试按钮
- [x] RAG 存储迁移：本地 39MB JSON → Supabase pgvector（HNSW 索引 + RPC 检索）
- [x] API 稳定性：429 限流感知 + 指数退避重试 + 流中断保护 + 空响应兜底

### 进行中 / 计划中 🚧

- [ ] **RAG 架构升级**：MCP 协议 + ReAct 推理循环
- [ ] **嵌入数据集扩充**：增加项目覆盖面，引入更多数据源
- [ ] **项目选取策略优化**：关注每周新增 star 数（增长趋势而非绝对值）
- [ ] 移动端体验优化
- [ ] 暗色/亮色主题切换
- [ ] 自定义站点 Logo

## License

MIT
