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
  → 7 数据源并发爬取 (RSS + GitHub API + HN + Reddit)
  → 去重 vs 已有数据 (public/trending.json)
  → GLM-4.7-Flash 双维度评分 (前沿性 + 信息含量, 0-100)
  → OR 门筛选 (任一维度 ≥ 80 直接入选, 否则综合 ≥ 60)
  → 写入 public/trending.json
  → GitHub Actions 每 12h 自动运行, commit & push
  → Vercel 检测变更后自动部署
  → Next.js SSR 读 JSON → TimelineView 客户端渲染
```

### 评分系统 (OR 门, 2026-06-07 重构)
- **前沿性** (0-100)：内容涉及的技术有多前沿？90+=行业里程碑, 70+=重要进展, 50+=常规动态
- **信息含量** (0-100)：包含多少实质信息？90+=含代码/数据, 70+=2-3个信息点, 50+=1个信息点
- **入选逻辑** (`should_accept` 函数):
  - 双维 < 25 → 淘汰（质量底线）
  - 任一维 ≥ 80 → 直接入选（OR 门）
  - 否则 → 加权综合 前沿×0.6 + 信息×0.4 ≥ 60 入选
- **Prompt 要点**：5 级锚定 + 3 个 few-shot 示例，约束 LLM 评分漂移
- **保底机制**：已移除多轮降门槛，改为软监控（不足时只打警告）

### 更新公告系统
- `public/changelog.json` 包含 `announcement`（顶部横幅）和 `entries`（更新日志）
- `layout.tsx` SSR 读取 announcement → `AnnouncementBanner` 显示可关闭横幅
- `/changelog` 页面用 `ChangelogView` 渲染时间线
- 用户关闭公告后 localStorage 记住日期，不再显示

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
| 笔记 | `/notes` | 🔲 空壳 | 待接入 Markdown/MDX |
| 项目 | `/projects` | 🔲 空壳 | 待接入 GitHub API |

## 关键文件速查

| 需求 | 文件 |
|------|------|
| 改评分逻辑 | `scripts/fetch_trending.py` → `should_accept()`, `SYSTEM_PROMPT` |
| 改 LLM Prompt | `scripts/fetch_trending.py` → `SYSTEM_PROMPT` |
| 改管道配置 | `.env`（本地）, `.github/workflows/trending.yml`（CI） |
| 加公告/更新日志 | `public/changelog.json` |
| 改热点 UI | `src/components/TimelineView.tsx` |
| 改全局样式 | `src/app/globals.css` |
| 改导航 | `src/components/Navbar.tsx` |
| 改主题系统 | `src/components/Customizer.tsx` + `src/lib/settings.ts` |

## 本地运行

```bash
npm install && npm run dev                    # Next.js 开发服务器
.venv/Scripts/python.exe scripts/fetch_trending.py  # 手动跑热点管道
```

## 注意事项

- AGENTS.md 里有 Next.js 16 breaking changes 警告：写代码前先读 `node_modules/next/dist/docs/`
- `.env` 里有 ZHIPU_API_KEY，不要泄露
- `public/trending.json` 和 `public/changelog.json` 是运行时数据，CI 会自动更新
- 前端 `page.tsx` 用 `fs.readFileSync` 读 JSON（SSR），不是客户端 fetch
- 旧的 `src/lib/trending.ts` 前端实时抓取方案已废弃并清除
