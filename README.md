# Flacko的取景框 🔭

> 个人知识库 — 学习、探索、创造

一个基于 Next.js 16 的个人知识站点，集成 AI 热点聚合、每日一言、自定义主题等功能。

## 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| **框架** | Next.js 16 (App Router + Turbopack) | 页面路由、SSR/SSG、API 集成 |
| **前端** | React 19 + TypeScript | UI 组件、状态管理 |
| **样式** | Tailwind CSS v4 + 自定义 CSS | 玻璃拟态设计系统 |
| **字体** | next/font (Inter + Noto Sans SC) | 零布局偏移的字体加载 |
| **图标** | Lucide React | 轻量 SVG 图标库 |
| **AI 管道** | Python + zai-sdk + GLM-4.7-Flash | 热点爬取 + LLM 筛选评分 |
| **数据源** | RSS / GitHub API / Semantic Scholar | 多源 AI 热点聚合 |
| **CI/CD** | GitHub Actions | 每 5 小时自动爬取热点 |

## 项目结构

```
src/
├── app/                    # 页面路由（App Router）
│   ├── layout.tsx          # 根布局（字体、导航、自定义面板）
│   ├── page.tsx            # 首页（每日一言）
│   ├── about/page.tsx      # 关于我
│   ├── notes/page.tsx      # 笔记（待建设）
│   ├── projects/page.tsx   # 项目展示（待建设）
│   ├── trending/page.tsx   # AI 热点时间线
│   └── globals.css         # 全局样式 + 玻璃拟态组件
├── components/             # UI 组件
│   ├── Navbar.tsx          # 导航栏（响应式 + 滚动效果）
│   ├── HomeContent.tsx     # 首页内容（背景 + 名言刷新）
│   ├── TimelineView.tsx    # 热点时间线视图
│   ├── Customizer.tsx      # 主题自定义面板
│   ├── SettingsProvider.tsx # 设置上下文（React Context + localStorage）
│   └── Footer.tsx          # 页脚
└── lib/                    # 工具库
    ├── quotes.ts           # 一言 API + 本地备用名言
    └── settings.ts         # 主题设置管理

scripts/
└── fetch_trending.py       # AI 热点爬取管道（GLM 筛选）

.github/workflows/
└── trending.yml            # GitHub Actions 自动爬取
```

## 代码阅读路线

如果你想从零理解这个项目，建议按以下顺序阅读：

### 第一阶段：入口和布局（理解页面骨架）

1. **`src/app/layout.tsx`** — 根布局，理解页面是如何组装的（字体、导航、Footer、自定义面板嵌套关系）
2. **`src/app/globals.css`** — 设计系统，所有玻璃拟态组件（`.glass`、`.glass-btn`、`.tag` 等）的定义
3. **`src/components/Navbar.tsx`** — 导航栏，学习响应式菜单 + 滚动监听

### 第二阶段：首页和交互（理解数据流）

4. **`src/app/page.tsx`** → **`src/components/HomeContent.tsx`** — 服务端获取数据，客户端渲染交互
5. **`src/lib/quotes.ts`** — API 调用 + 错误处理 + 本地降级
6. **`src/components/SettingsProvider.tsx`** → **`src/lib/settings.ts`** — React Context 状态管理 + localStorage 持久化
7. **`src/components/Customizer.tsx`** — 主题自定义面板，学习滑块控制 + 文件上传 + 实时预览

### 第三阶段：数据聚合（理解算法）

8. **`src/app/trending/page.tsx`** → **`src/components/TimelineView.tsx`** — 数据到 UI 的渲染
9. **`scripts/fetch_trending.py`** — Python 爬取管道，理解 LLM 筛选流程

### 第四阶段：其他页面

10. **`src/app/about/page.tsx`** — 静态页面，学习渐变文字和徽章布局
11. **`src/app/notes/page.tsx`** — 搜索 + 分类过滤的 UI 模式
12. **`src/app/projects/page.tsx`** — 网格布局 + 状态标签

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
  - 需要考虑：Python 爬取管道在哪里跑？GitHub Actions 写回 repo 的数据能不能被静态部署读取？
  - 关键问题：SSR 页面（首页名言、热点）需要服务端运行时，纯静态托管不够
  - 解决：选择了vercel部署我的网站，然后在阿里云买了我个人的域名flackoye.bond

- [ ] **热点爬取质量评估**：观察几天后评估
  - GLM 筛选的评分是否合理？是否有些优质内容被误判？
  - Semantic Scholar 限流问题怎么解决（代理？降低频率？换 API？）
  - GitHub Trending 的搜索词 `AI OR LLM OR transformer` 是否太宽泛，导致混入无关项目？

- [x] **`trending.ts` vs `fetch_trending.py` 的关系**：目前有两条热点数据链路
  - 前端 `src/lib/trending.ts`：运行时从 HN/Reddit/arxiv 实时抓取
  - 后端 `scripts/fetch_trending.py`：定时爬取 + LLM 筛选 → 写入 `public/trending.json`
  - 两条链路数据源有重叠，应考虑统一
  - 解决：trending是之前版本的热点爬取方案，选取的arkiv、hackernews这样的，效果太差，但是忘记清除了

## 想提升的方向

- [ ] **RSS 源稳定性**：Hugging Face 和 DeepMind 经常超时
  - 考虑加代理或换源
  - 可以用 GitHub Actions 的 Ubuntu 环境跑（网络比本地好）

- [ ] **前端热点数据加载体验**：`trending/page.tsx` 直接读 JSON，没有 loading 状态
  - 加骨架屏或 Suspense 占位
  - 客户端 fetch + SWR/React Query 做增量更新

- [ ] **暗色/亮色主题切换**：目前只有暗色主题
  - CSS 变量已经有一部分基础，可以扩展
  - Tailwind v4 的 `@media (prefers-color-scheme)` 或手动切换

- [ ] **笔记和项目页面的真实内容**：目前 notes 和 projects 都是空壳
  - 笔记：接入 Markdown 渲染，从本地 `.md` 文件或数据库读取
  - 项目：可以接入 GitHub API 自动拉取仓库信息

- [ ] **搜索功能**：全局搜索（笔记 + 项目 + 热点）
  - 简单方案：前端 Fuse.js 模糊搜索
  - 进阶方案：接入 Meilisearch / Algolia

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
  - 学习：Token 计算、上下文窗口管理、消息截断策略

#### 第二阶段：知识库 + RAG（检索增强生成）

- [ ] **个人知识库向量化**：把笔记、收藏的热点文章转成 Embedding 向量
  - 技术栈：智谱 Embedding-3 API + pgvector（Supabase）或本地 ChromaDB
  - 学习：文本分块（chunking）、向量化、相似度检索
- [ ] **RAG 问答**：用户提问时，先从知识库检索相关内容，再送给 LLM 生成回答
  - 学习：Retrieval-Augmented Generation 的完整流程
  - 效果：问 "Transformer 的注意力机制怎么工作的？" → 从你的笔记中找答案
- [ ] **知识库管理界面**：上传文档、查看分块结果、调整检索参数

#### 第三阶段：Agent 助手

- [ ] **工具调用（Function Calling）**：让 AI 助手能调用外部工具
  - 示例：用户说 "帮我搜一下最新的 LLM 论文" → Agent 调用 Semantic Scholar API → 返回结果
  - 学习：Function Calling 协议、工具描述设计、多工具编排
- [ ] **多步推理 Agent**：实现 ReAct（Reasoning + Acting）循环
  - 用户问复杂问题时，Agent 自动拆解为多个子任务，逐步执行
  - 学习：Agent 循环、观察-思考-行动模式、错误恢复
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
  - 热点数据持久化，不用每次 commit JSON 到 repo
  - 可以做分页、搜索、收藏等高级功能
- [ ] **全栈功能**：用户系统（NextAuth.js）
  - 登录后可以收藏热点、写笔记、自定义首页
- [ ] **RSS 订阅输出**：让别人的 RSS 阅读器能订阅你的站点更新

### 🚀 挑战级（工程化提升）

- [ ] **单元测试**：给 `quotes.ts` 的降级逻辑和 `fetch_trending.py` 的评分算法写测试（Jest + React Testing Library）
- [ ] **E2E 测试**：用 Playwright 跑关键用户路径（首页加载 → 点击热点 → 查看详情）
- [ ] **Docker 容器化**：把 Next.js + Python 爬取管道打包成 Docker Compose，一键部署到任何服务器
- [ ] **CI/CD 流水线**：不只是爬取热点，还能自动跑 lint、测试、构建、部署
