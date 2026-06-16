# CLAUDE.md — 项目知识库

> 这个文件是给 Claude Code 的项目上下文。每次新对话开始时会被加载。
> 保持更新，确保任何新对话窗口都能接上。

## 项目概览

**Flacko的取景框** — 个人知识站点，面向所有关注 AI 的计算机从业者。
- 域名：https://flackoye.bond
- 部署：Vercel（自动从 GitHub main 分支构建）
- 框架：Next.js 16 + React 19 + TypeScript + Tailwind CSS v4

## 架构决策

### 热点数据流
```
Python 管道 (scripts/fetch_trending.py)
  → 12 数据源并发爬取 (RSS×3 + GitHub API + HN + Reddit×5 + ArXiv×2)
  → 去重 vs 已有数据 (public/trending.json)
  → GLM-4.7 双维度评分 (前沿性 + 信息含量, 0-100)
  → 三套 OR 门筛选:
      · 通用: 任一维 ≥ 80 入选, 否则 前沿×0.6+信息×0.4 ≥ 60
      · ArXiv: 任一维 ≥ 70 入选, 否则 综合 ≥ 65 (有开源代码可降至 55)
      · 开源: 任一维 ≥ 60 入选, 否则 综合 ≥ 50 (高星再降一档)
  → 串行评分 + 6s 间隔 (控制账户级 RPM 限速, code 1302)
  → 写入 public/trending.json
  → GitHub Actions 每 12h 自动运行, commit & push
  → Vercel 检测变更后自动部署
  → Next.js SSR 读 JSON → TimelineView 客户端渲染
```

### GitHub 源抓取策略（2026-06-15 改进）
- **初筛 query**：`LLM OR GPT OR transformer created:>7天前`，按 stars 降序取 top20
  - 实测去掉宽泛的 "AI" 后召回总量 ~11.4万 → ~1.5万，避免 "AI" 全文匹配把蹭热度的写作/插画/statusline 项目捞进来
  - ⚠️ GitHub Search API 限制：`topic:` 等 qualifier 不能用 OR 连接、最多 5 个 AND/OR，故只能用关键词 OR，topic 仅作 AND 收紧
- **timestamp 语义**：GitHub 条目用**抓取时间**而非仓库 `created_at`，让它与 ArXiv/Reddit 一样出现在时间线最新分组（仓库创建时间 + 搜索索引延迟会让 GitHub 系统性沉底）；真实创建时间存 `created_at` 字段备查
- **保留窗口**：`MAX_AGE_DAYS=7`（2026-06-15 从 5 天放宽到 7 天）

### 评分系统 (三套 OR 门, 2026-06-07 重构, 2026-06-15 开源门 + GitHub 初筛改进)
- **前沿性** (0-100)：内容涉及的技术有多前沿？90+=行业里程碑, 70+=重要进展, 50+=常规动态
- **信息含量** (0-100)：包含多少实质信息？90+=含代码/数据, 70+=2-3个信息点, 50+=1个信息点
- **入选逻辑** (`should_accept` 函数):
  - 双维 < 25 → 淘汰（质量底线）
  - 任一维 ≥ 80 → 直接入选（OR 门）
  - 否则 → 加权综合 前沿×0.6 + 信息×0.4 ≥ 60 入选
- **Prompt 要点**：5 级锚定 + 3 个 few-shot 示例，约束 LLM 评分漂移
- **保底机制**：已移除多轮降门槛，改为软监控（不足时只打警告）
- **开源项目专用门** (`should_accept_opensource`): GitHub Trending 高星新仓库门槛放宽
  - 任一维 ≥ 60 → 入选（高星新仓库天然可访问代码，信息含量应更高）
  - 加权综合 前沿×0.5+信息×0.5 ≥ 50 → 入选
  - stars ≥ 500 时综合线降至 40
  - ⭐ stars ≥ 200 直通入选（绕过 LLM）：LLM 评分看不到 stars，高星新仓库常被主观误杀（如 ⭐1w+ 的 ponytail 连续被砍），用绝对社区热度兜底。常量 `OPENSOURCE_STAR_FAST_PATH`
- **LLM 速率控制**: 串行评分（`LLM_CONCURRENCY=1`）+ 请求间隔（`LLM_REQUEST_INTERVAL=6s`），避免触发智谱账户级 RPM 限速（code 1302）。429 退避拉长到 15/30/45/60s 跨过窗口。⚠️ RPM 是账户级共享，Key 分离不隔离速率。
- **ArXiv 选品** (`coarse_rank_arxiv`): 粗筛通过 ~185 篇后，按**质量相关性**排序（关键词命中数 + has_code×3 + lab_match×4）取 top 20 送筛，而非纯按时间。本地诊断证实：纯按时间会让送筛质量随抓取时刻随机波动（CI 曾连续 0/10，同一套逻辑本地却 6/12 通过——因为"最新 20 篇"有时恰好都是中庸论文）。改为质量排序后 top20 稳定含 12/20 有代码、4/20 顶级实验室。
- **❌ 可观测**: 淘汰条目也打印 `F/S/综合` 分数，让 0/N 异常可诊断（此前 ❌ 黑箱，无法判断是门槛太高、prompt 过严还是选品差）。

### 更新公告系统
- `public/changelog.json` 包含 `announcement`（顶部横幅）和 `entries`（更新日志）
- `layout.tsx` SSR 读取 announcement → `AnnouncementBanner` 显示可关闭横幅
- `/changelog` 页面用 `ChangelogView` 渲染时间线
- 用户关闭公告后 localStorage 记住日期，不再显示

### AI 项目导航 —「万象索骥」（RAG + Supabase pgvector + 双模式）
```
线下 Python 管道：
  GitHub Search API (7 分类, 每类 ~15 个高星项目)
  → 拉 README → Markdown 感知切块 (~1500 字符/块)
  → 智谱 Embedding-3 (512 维) → 直写 Supabase pgvector
  → 项目元数据 → Supabase projects 表

线上 Next.js 多页面架构：
  /projects          → 落地页（数据概览 + 分类分布 + 管道图 + 模式选择）
  /projects/explore  → 引导模式（Socratic 表格交互 + Klein Blue 选项）
  /projects/assistant → 助手模式（自由对话）
  POST /api/projects → mode=guided|assistant + category 过滤
    → embedQuery() 向量化用户提问
    → Supabase RPC match_chunks() 返回 Top-K 相关片段
    → 片段拼入 Prompt → GLM 流式生成
  → SSE 流式输出 (chunk/options/suggestions/projects/done)

Supabase 表结构：
  projects          — 项目元数据（id, full_name, stars, category, ...）
  embedding_chunks  — 向量索引（id, text, embedding vector(512), category）
  match_chunks()    — RPC 函数，HNSW 索引 + 余弦距离 Top-K
```

### 前端设计系统
- 玻璃拟态（glassmorphism）：`.glass`、`.glass-btn`、`.glass-nav` 等 CSS 类在 `globals.css`
- 暗色主题为主，CSS 变量控制主题色
- `Customizer` 组件支持用户自定义背景图、亮度、卡片透明度
- 设置通过 `SettingsProvider` (React Context) + localStorage 持久化

## 页面状态

| 页面 | 路由 | 状态 | 说明 |
|------|------|------|------|
| 首页 | `/` | ✅ 完成 | 每日一言 + 背景交互 |
| 热点 | `/trending` | ✅ 完成 | 时间线 + 统计卡片 + 来源标签 |
| 更新日志 | `/changelog` | ✅ 完成 | 版本时间线 + 顶部公告 |
| 关于 | `/about` | ✅ 完成 | 个人信息 + 技术栈 + 收藏网址 |
| 项目落地页 | `/projects` | ✅ 完成 | 万象索骥 — 数据概览 + 分类分布 + 模式选择 |
| 引导探索 | `/projects/explore` | ✅ 完成 | Socratic 表格交互 + Klein Blue 选项 + 项目推荐 |
| 自由对话 | `/projects/assistant` | ✅ 完成 | 直接聊天 + RAG 检索 + 项目卡片 |

## 关键文件速查

| 需求 | 文件 |
|------|------|
| 改评分逻辑 | `scripts/fetch_trending.py` → `should_accept()`, `should_accept_opensource()`, `should_accept_arxiv()` |
| 改 LLM Prompt | `scripts/fetch_trending.py` → `SYSTEM_PROMPT` |
| 改管道配置 | `.env`（本地）, `.github/workflows/trending.yml`（CI） |
| 加公告/更新日志 | `public/changelog.json` |
| 改热点 UI | `src/components/TimelineView.tsx` |
| 改项目落地页 | `src/components/ProjectLanding.tsx` |
| 改引导探索 | `src/components/GuidedExplore.tsx` + `src/components/OptionTable.tsx` |
| 改自由对话 | `src/components/AssistantChat.tsx` |
| 改 RAG 检索/Prompt | `src/lib/rag.ts` → `buildGuidedPrompt()`, `buildAssistantPrompt()`, `embedQuery()` |
| 改项目 API | `src/app/api/projects/route.ts`（Supabase RPC 调用） |
| 改 Supabase 配置 | `src/lib/supabase.ts`（客户端单例） |
| 改分类定义 | `src/lib/categories.ts` |
| 重建 RAG 索引 | `scripts/build_rag_index.py` → 直写 Supabase |
| 改 Supabase 表结构 | `scripts/supabase_init.sql`（建表 + 索引 + RPC） |
| 改全局样式 | `src/app/globals.css` |
| 改导航 | `src/components/Navbar.tsx` |
| 改主题系统 | `src/components/Customizer.tsx` + `src/lib/settings.ts` |

## 本地运行

```bash
npm install && npm run dev                    # Next.js 开发服务器
.venv/Scripts/python.exe scripts/fetch_trending.py  # 手动跑热点管道
PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -u scripts/build_rag_index.py  # 重建项目索引
```

## 注意事项

- Next.js 16 有 breaking changes：写代码前先读 `node_modules/next/dist/docs/`
- `.env` 里有 ZHIPU_API_KEY、ZHIPU_RAG_API_KEY、ZHIPU_TRENDING_API_KEY、GITHUB_TOKEN、SUPABASE_URL、SUPABASE_SERVICE_KEY，不要泄露
- API Key 职责分离：`ZHIPU_API_KEY` 仅用于 Embedding，`ZHIPU_RAG_API_KEY` 用于 RAG 对话，`ZHIPU_TRENDING_API_KEY` 用于热点评分。⚠️ 三把 key 共享账户级 RPM 限速（code 1302），Key 分离不能隔离速率限制
- 热点管道 LLM 评分采用串行 + 请求间隔（`LLM_CONCURRENCY=1`, `LLM_REQUEST_INTERVAL=6s`），避免触发智谱账户级 RPM 限速
- `public/trending.json` 和 `public/changelog.json` 是运行时数据，CI 会自动更新
- RAG 数据存储在 Supabase pgvector（`projects` + `embedding_chunks` 表），不再依赖本地 JSON
- `public/projects.json` 仅作本地开发参考，线上从 Supabase 读取
- `public/project_embeddings.json` 已从 git 移除（39MB），过渡期脚本仍会导出但不提交
- SSR 页面通过 `supabase.ts` 客户端查询数据库，不再使用 `fs.readFileSync`
- 项目导航 API Route (`/api/projects`) 使用 SSE 流式输出，Supabase RPC `match_chunks()` 做向量检索
- OptionTable 组件支持 `value` 字段（数据库用 name 如 "Agent"，前端显示 label 如 "AI Agent"）
- Vercel 和 GitHub Actions 都需要配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY` 环境变量
- 📌 **改完代码必须同步更新文档**（CLAUDE.md / README.md / changelog.json），保持文档与代码一致，主动做不等提醒
- HackerNews 源用 algolia API（`hn.algolia.com`）：**多词 query 默认 AND**，必须配 `optionalWords`（同值）才得 OR，否则 4 词 query 返回 0；`points>5` + `created_at_i>N天前` 服务端过滤。历史曾因 query 写法错误导致 HN 长期 0 items
