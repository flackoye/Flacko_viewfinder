# Flacko的取景框 🔭

> 个人知识库 — 学习、探索、创造

一个基于 Next.js 16 的个人知识站点，集成 AI 热点聚合、每日一言、自定义主题等功能。

## 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| **框架** | Next.js 16 (App Router + Turbopack) | 页面路由、SSR/SSG |
| **前端** | React 19 + TypeScript | UI 组件 |
| **样式** | Tailwind CSS v4 + 自定义 CSS | 玻璃拟态设计系统 |
| **AI 管道** | Python + zai-sdk + GLM-4.7-Flash | 多源爬取 + LLM 筛选评分 |
| **数据源** | RSS / GitHub API / HackerNews / Reddit | 多源 AI 热点聚合 |
| **CI/CD** | GitHub Actions | 每 12 小时自动爬取 + 评分 + 提交 |

## 项目结构

```
src/
├── app/                        # 页面路由（App Router）
│   ├── layout.tsx              # 根布局（字体、导航、公告栏、自定义面板）
│   ├── page.tsx                # 首页（每日一言）
│   ├── about/page.tsx          # 关于我
│   ├── changelog/page.tsx      # 更新日志（读 changelog.json → ChangelogView）
│   ├── notes/page.tsx          # 笔记（待建设）
│   ├── projects/page.tsx       # 项目展示（待建设）
│   ├── trending/page.tsx       # AI 热点（读 trending.json → TimelineView）
│   └── globals.css             # 全局样式 + 玻璃拟态设计系统
├── components/
│   ├── Navbar.tsx              # 导航栏（响应式 + 滚动效果，含日志入口）
│   ├── HomeContent.tsx         # 首页交互（背景 + 名言刷新）
│   ├── TimelineView.tsx        # 热点时间线（统计卡片 + 日期分组 + 来源标签）
│   ├── ChangelogView.tsx       # 更新日志时间线（版本号 + 变更列表）
│   ├── AnnouncementBanner.tsx  # 置顶公告栏（可关闭，localStorage 记住）
│   ├── Customizer.tsx          # 主题自定义面板（背景图 + 亮度 + 玻璃透明度）
│   ├── SettingsProvider.tsx    # 设置上下文（React Context + localStorage）
│   ├── ScrollReveal.tsx        # 滚动揭示组件
│   └── Footer.tsx              # 页脚
├── hooks/
│   └── useScrollReveal.ts      # 滚动揭示 Hook（IntersectionObserver）
└── lib/
    ├── quotes.ts               # 一言 API + 本地备用名言
    └── settings.ts             # 主题设置管理（localStorage 持久化）

scripts/
└── fetch_trending.py           # AI 热点爬取管道（异步爬取 + LLM OR门评分）

public/
├── trending.json               # 热点数据（管道生成，CI 自动提交）
└── changelog.json              # 更新日志 + 公告数据

.github/workflows/
└── trending.yml                # GitHub Actions（每 12 小时自动运行管道）
```

## 项目亮点

### 1. LLM 驱动的内容筛选管道

`scripts/fetch_trending.py` 是一个完整的异步数据管道：从 7 个数据源（RSS / GitHub API / HackerNews / Reddit）并发爬取原始内容，然后交给 GLM-4.7-Flash 对每条内容进行双维度评分。

评分系统的核心设计决策是 **OR 门而非 AND 门**：只要一条内容在「前沿性」或「信息含量」任意一个维度足够高，就直接入选。这避免了一个常见问题——用加权平均打分时，重磅 PR（前沿性 95、信息含量 30）会因为"信息含量低"被拉低总分而遭到误杀。

Prompt 中包含 5 级锚定描述（如"90-100 = 行业里程碑"）和 3 个 few-shot 示例，用来约束 LLM 的评分漂移。


### 2. 全自动 CI/CD 数据管道

GitHub Actions 每 12 小时自动运行一次完整管道：爬取 → 去重 → LLM 评分 → 写入 JSON → commit & push 回仓库。Vercel 检测到 `public/trending.json` 变更后自动重新部署。

管道中有 git stash + rebase 的冲突处理逻辑，防止 CI run 之间的 race condition。

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 爬取 AI 热点（需要 .env 中的 ZHIPU_API_KEY）
.venv/Scripts/python.exe scripts/fetch_trending.py
```

## 部署

- **平台**：Vercel（自动从 GitHub 同步）
- **域名**：https://flackoye.bond
- **流程**：`git push` → Vercel 自动构建部署

---

# 📋 开发路线图

## 待探究的问题

- [x] **免费部署方案**：如何把站点免费部署到一个长期稳定运行的服务上？
  - 备选：Vercel（Next.js 亲儿子）、Cloudflare Pages、Netlify
  - 解决：选择了 Vercel 部署，在阿里云购买个人域名 flackoye.bond

- [x] **热点爬取质量评估**：观察几天后评估
  - GLM 筛选的评分是否合理？是否有些优质内容被误判？
  - 解决：从 4 维 AND 门重构为 2 维 OR 门，大幅减少误杀 + 消除保底垃圾

- [x] **`trending.ts` vs `fetch_trending.py` 的关系**：目前有两条热点数据链路
  - 解决：统一为 Python 管道方案，清除旧的前端实时抓取代码

## 想提升的方向

- [x] **丰富热点内容**：目前每次约 20 条抓取 → 10 条通过筛选，目标是增加到 50 条
  - 解决：增加数据源（HN、Reddit），优化评分系统（OR 门 + 锚定 Prompt）

- [x] **RSS 源稳定性**：Hugging Face 和 DeepMind 经常超时
  - 解决：迁移到 GitHub Actions 的 Ubuntu 环境运行，网络更稳定

- [ ] **前端热点数据加载体验**：`trending/page.tsx` 直接读 JSON，没有 loading 状态
  - 加骨架屏或 Suspense 占位
  - 客户端 fetch + SWR/React Query 做增量更新

- [ ] **暗色/亮色主题切换**：目前只有暗色主题
  - CSS 变量已经有一部分基础，可以扩展

- [ ] **笔记和项目页面的真实内容**：目前 notes 和 projects 都是空壳

- [ ] **搜索功能**：全局搜索（笔记 + 项目 + 热点）

- [ ] **移动端体验优化**：Navbar 已有响应式，但部分页面内容在小屏幕上可能不够友好

## 后续 Coding 方向

### 🔰 入门级（巩固现有技能）

- [ ] **完成 Notes 页面**：用 MDX 实现笔记系统，学习 Next.js 动态路由 `[slug]`
- [ ] **完成 Projects 页面**：从 GitHub API 拉取仓库列表，练习 `fetch` + 缓存策略
- [ ] **添加页面过渡动画**：用 Framer Motion 实现 page transition
- [ ] **性能优化**：跑一次 Lighthouse，针对 LCP/CLS/FID 逐项优化

### 🧠 LLM 应用方向（核心特色）

这是本项目最想突破的方向——把学到的 LLM 底层知识落地到真实产品中。

#### 第一阶段：AI 对话助手

- [ ] **站内 AI 聊天窗口**：嵌入一个基于 GLM API 的对话组件
  - 可以问 "最近 AI 有什么新进展？" → 基于热点数据回答
  - 学习：Prompt Engineering、流式输出（SSE）、对话上下文管理
  - 技术栈：Next.js Route Handler + zai-sdk + React Streaming
- [ ] **对话历史记忆**：用 cookie/localStorage 保存聊天记录，实现多轮对话

#### 第二阶段：知识库 + RAG（检索增强生成）

- [ ] **个人知识库向量化**：把笔记、收藏的热点文章转成 Embedding 向量
  - 技术栈：智谱 Embedding-3 API + pgvector（Supabase）或本地 ChromaDB
  - 学习：文本分块（chunking）、向量化、相似度检索
- [ ] **RAG 问答**：用户提问时，先从知识库检索相关内容，再送给 LLM 生成回答

#### 第三阶段：Agent 助手

- [ ] **工具调用（Function Calling）**：让 AI 助手能调用外部工具
  - 示例：用户说 "帮我搜一下最新的 LLM 论文" → Agent 调用 Semantic Scholar API → 返回结果
- [ ] **多步推理 Agent**：实现 ReAct（Reasoning + Acting）循环
  - 用户问复杂问题时，Agent 自动拆解为多个子任务，逐步执行
- [ ] **自定义 Agent 技能**：定义一组可复用的 "Skill"（搜索、总结、翻译、对比），Agent 自主选择执行

#### 💡 涉及的 LLM 底层概念 → 工程落地映射

| 学过的底层概念 | 在本项目中的落地方式 |
|---------------|-------------------|
| Tokenization | 控制对话上下文长度、计算 API 调用成本 |
| Embedding | 笔记和热点向量化，支撑语义搜索 |
| Attention / Self-Attention | 理解 RAG 为什么能 "找到相关内容" |
| Temperature / Top-p Sampling | 已在热点筛选中应用（`.env` 配置） |
| Prompt Engineering | System Prompt 设计（已在 `fetch_trending.py` 中使用） |
| Function Calling | Agent 工具调用的底层协议 |
| Streaming (SSE) | 聊天窗口的逐字输出体验 |

### 🔥 进阶级（全栈工程）

- [ ] **接入数据库**：用 Prisma + Supabase/PlanetScale 替代 JSON 文件存储热点数据
- [ ] **全栈功能**：用户系统（NextAuth.js）
- [ ] **RSS 订阅输出**：让别人的 RSS 阅读器能订阅你的站点更新

### 🚀 挑战级（工程化提升）

- [ ] **单元测试**：给 `quotes.ts` 的降级逻辑和 `fetch_trending.py` 的评分算法写测试
- [ ] **E2E 测试**：用 Playwright 跑关键用户路径
- [ ] **Docker 容器化**：把 Next.js + Python 爬取管道打包成 Docker Compose
- [ ] **CI/CD 流水线**：不只是爬取热点，还能自动跑 lint、测试、构建、部署
