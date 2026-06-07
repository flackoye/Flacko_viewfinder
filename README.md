# Flacko的取景框 🔭

> 面向所有关注 AI 的计算机从业者的个人知识站点。

**线上地址**：[flackoye.bond](https://flackoye.bond)

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 + React 19 + TypeScript |
| 样式 | Tailwind CSS v4（暗色主题 + 玻璃拟态） |
| 部署 | Vercel（GitHub main 分支自动构建） |
| 数据管道 | Python（异步爬取 + LLM 评分 + RAG 索引构建） |
| LLM | 智谱 GLM-4.7-Flash（评分/对话）、Embedding-3（512 维向量） |
| CI/CD | GitHub Actions（每 12h 更新热点数据） |

## 功能模块

### 🔥 AI 热点追踪（`/trending`）

7 个数据源并发爬取（RSS、GitHub Trending、Hacker News、Reddit 等），经 GLM 双维度评分后自动筛选，时间线式展示。

评分采用 **OR 门**设计：任一维度（前沿性/信息含量）≥ 80 直接入选，避免重磅 PR 因另一维度低被误杀。Prompt 内含 5 级锚定 + 3 个 few-shot 示例约束漂移。

### 🧭 万象索骥 — AI 项目导航（`/projects`）

基于 RAG 的开源项目推荐系统：

- **引导探索** — Socratic 式多轮对话，逐步建立用户画像后精准推荐
- **自由对话** — 直接描述需求，AI 即时推荐
- 项目以可视化卡片展示（stars、语言、分类、topics）
- SSE 流式输出 + 实时打字效果

线下管道：GitHub Search API → README 切块 → 智谱 Embedding-3 → 40MB 向量索引

### 📝 其他页面

| 页面 | 说明 |
|------|------|
| `/` | 首页 — 每日一言 + 星空/极光可交互背景 |
| `/changelog` | 更新日志 — 版本时间线 + 顶部公告横幅 |
| `/about` | 关于 — 个人信息、技术栈、收藏网址 |

## 架构概览

```
┌───────────────── 线下管道 ─────────────────┐
│  scripts/fetch_trending.py                  │
│    7 源并发爬取 → 去重 → LLM 评分 → JSON    │
│                                             │
│  scripts/build_rag_index.py                 │
│    GitHub Search → README → 切块 → Embedding│
│    → public/project_embeddings.json (40MB)  │
│    → public/projects.json (110KB)           │
└──────────────────┬──────────────────────────┘
                   │ CI 每 12h 自动 commit & push
                   ▼
┌───────────────── Vercel ───────────────────┐
│  Next.js 16 SSR                             │
│    ├─ fs.readFileSync → 页面数据            │
│    ├─ API Route (/api/projects)             │
│    │    模块级缓存 Embedding 索引            │
│    │    → 余弦相似度 Top-K → GLM 流式生成   │
│    └─ SSE → 前端实时渲染                    │
└────────────────────────────────────────────┘
```

## 项目结构

```
├── public/
│   ├── trending.json              # 热点数据（CI 自动更新）
│   ├── changelog.json             # 更新公告/日志
│   ├── projects.json              # 项目元数据
│   └── project_embeddings.json    # RAG 向量索引
├── scripts/
│   ├── fetch_trending.py          # 热点爬取 + LLM 评分管道
│   ├── build_rag_index.py         # RAG 索引构建（Embedding）
│   └── github_search.py           # GitHub 项目搜索
├── src/
│   ├── app/
│   │   ├── page.tsx               # 首页
│   │   ├── layout.tsx             # 根布局（导航 + 公告横幅）
│   │   ├── globals.css            # 全局样式 + 玻璃拟态
│   │   ├── trending/              # 热点页
│   │   ├── changelog/             # 更新日志
│   │   ├── about/                 # 关于页
│   │   ├── projects/              # 项目导航
│   │   │   ├── page.tsx           # 落地页
│   │   │   ├── explore/           # 引导探索
│   │   │   └── assistant/         # 自由对话
│   │   └── api/projects/          # SSE 流式 API
│   ├── components/
│   │   ├── Navbar.tsx             # 导航栏
│   │   ├── TimelineView.tsx       # 热点时间线
│   │   ├── ProjectLanding.tsx     # 项目落地页
│   │   ├── ProjectCard.tsx        # 项目推荐卡片
│   │   ├── GuidedExplore.tsx      # 引导探索对话
│   │   ├── AssistantChat.tsx      # 自由对话
│   │   ├── ChatMessage.tsx        # 消息渲染（Markdown + 卡片）
│   │   ├── OptionTable.tsx        # 选项表格
│   │   ├── StarfieldBackground.tsx # 星空/极光背景
│   │   └── Customizer.tsx         # 首页背景自定义
│   └── lib/
│       ├── rag.ts                 # RAG 核心（检索 + Prompt + 标签解析）
│       ├── categories.ts          # 项目分类定义
│       ├── project-types.ts       # TypeScript 类型
│       └── settings.ts            # 主题设置
├── .github/workflows/
│   └── trending.yml               # GitHub Actions 定时任务
├── CLAUDE.md                       # Claude Code 项目上下文
└── README.md
```

## 本地开发

```bash
# 前端
npm install && npm run dev

# 热点数据管道（需要 .env 中的 ZHIPU_API_KEY）
.venv/Scripts/python.exe scripts/fetch_trending.py

# 重建 RAG 索引（需要 .env 中的 ZHIPU_API_KEY + GITHUB_TOKEN）
PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -u scripts/build_rag_index.py
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `ZHIPU_API_KEY` | 智谱 AI API 密钥（评分 + 对话 + Embedding） |
| `GITHUB_TOKEN` | GitHub Personal Access Token（项目搜索） |

## 路线图

### 已完成 ✅

- [x] AI 热点追踪：7 源并发爬取 + OR 门评分 + 时间线展示
- [x] AI 项目导航「万象索骥」：RAG + 双模式对话 + 可视化卡片
- [x] 更新公告系统：横幅 + 时间线
- [x] 首页：每日一言 + 星空/极光交互背景
- [x] 全自动 CI/CD：GitHub Actions 每 12h 更新热点
- [x] API 重试机制：指数退避 + 前端重试按钮

### 进行中 / 计划中 🚧

- [ ] **RAG 架构升级**：MCP 协议 + ReAct 推理循环
- [ ] **嵌入数据集扩充**：增加项目覆盖面，引入更多数据源
- [ ] **项目选取策略优化**：关注每周新增 star 数（增长趋势而非绝对值）
- [ ] 移动端体验优化
- [ ] 暗色/亮色主题切换

## License

MIT
