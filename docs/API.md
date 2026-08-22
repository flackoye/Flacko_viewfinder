# 接口文档

本文档描述站点当前可调用的 HTTP 接口、SSE 事件、数据文件、Supabase RPC 和外部服务契约。实现基线为 Next.js 16 App Router。

## 1. 系统边界

```text
浏览器
  ├─ 页面路由（SSR / Client Components）
  ├─ POST /api/projects（SSE）
  │    ├─ Embedding API（智谱，向量化查询）
  │    ├─ Supabase match_chunks()
  │    └─ LLM Messages API（anthropic 兼容，对话流式）
  └─ 一言 API（首页“换一句”，失败时使用本地语料）

离线任务
  ├─ fetch_trending.py → public/trending.json
  └─ build_rag_index.py → Supabase + public/projects.json
```

服务端使用 `SUPABASE_SERVICE_KEY`，浏览器不会直接访问 Supabase，也不应获得 service role key。

## 2. 页面路由

| 方法 | 路径 | 渲染方式 | 说明 |
|---|---|---|---|
| GET | `/` | SSR + Client | 个人简介、每日一言、最近记录和首页外观设置 |
| GET | `/trending` | SSR + Client | 读取 `public/trending.json`，渲染 AI 热点时间线 |
| GET | `/projects` | SSR + Client | 从 Supabase 读取项目与向量索引统计 |
| GET | `/projects/explore` | SSR + Client | 引导式项目探索 |
| GET | `/projects/assistant` | Client | 自由对话项目助手 |
| GET | `/changelog` | SSR | 读取 `public/changelog.json` |
| GET | `/records` | SSR | 读取 `content/records`，按日期展示公开记录 |
| GET | `/records/[...slug]` | SSR | 渲染 Markdown 正文、图片、公式、代码和表格 |
| GET | `/about` | SSR | 读取 `content/profile.json` 与精选记录 |

## 3. 项目推荐 API

实现位置：`src/app/api/projects/route.ts`。

### 3.1 健康检查

```http
GET /api/projects
```

成功响应：

```json
{
  "ok": true,
  "projects": 150,
  "chunks": 5079,
  "supabaseUrl": "✅ set",
  "supabaseKey": "✅ set",
  "llmKey": "✅ set"
}
```

数据库查询失败时仍返回 JSON，但 `ok` 为 `false`。该端点用于诊断，不代表上游 LLM 一定可用。

### 3.2 发起推荐对话

```http
POST /api/projects
Content-Type: application/json
Accept: text/event-stream
```

请求体：

| 字段 | 类型 | 必需 | 约束 | 说明 |
|---|---|:---:|---|---|
| `question` | `string` | 是 | 去空格后 1–1000 字符 | 当前问题 |
| `history` | `ChatHistoryMessage[]` | 否 | 默认使用最后 30 条；单条最多 4000 字符，可通过环境变量调整 | 仅接受 `role` 和 `content` |
| `mode` | `"guided" \| "assistant"` | 否 | 默认 `assistant` | 引导探索或自由对话 |
| `category` | `string` | 否 | 必须是下表分类之一 | 引导模式的检索过滤条件 |

`ChatHistoryMessage`：

```ts
interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

有效分类值：

```text
Agent
LLM
RAG
Prompt Engineering
Diffusion
Vector DB
Data & Training
```

请求示例：

```json
{
  "question": "我想用 TypeScript 做一个有工具调用能力的 Agent",
  "history": [
    { "role": "user", "content": "我更倾向 Web 技术栈" },
    { "role": "assistant", "content": "你希望用于学习还是生产环境？" }
  ],
  "mode": "guided",
  "category": "Agent"
}
```

### 3.3 SSE 响应

成功响应头：

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

每条事件使用默认 SSE `message` 事件，载荷位于 `data:` 后：

```text
data: {"type":"chunk","content":"可以先考虑"}

data: {"type":"projects","projects":[...]}

data: {"type":"done"}

```

事件类型：

| `type` | 载荷 | 数量限制 | 语义 |
|---|---|---:|---|
| `chunk` | `{ content: string }` | 不定 | LLM 增量文本 |
| `options` | `{ items: string[] }` | 最多 8 个 | 引导模式的结构化选项 |
| `suggestions` | `{ items: string[] }` | 最多 5 个 | 回答后的追问建议 |
| `guided_progress` | `{ progress: GuidedProgress }` | 引导模式每轮最多 1 个 | 方向、背景、需求、约束的调查完成状态 |
| `projects` | `{ projects: Project[] }` | 默认最多 6 个推荐结果 | 只渲染模型通过 `<project>` 明确推荐且项目表中真实存在的仓库；不会把整个向量候选池作为替代结果发送。引导模式仅在调查完整并经下一轮确认后发送 |
| `done` | `{ error?: string }` | 1 个 | 流结束；空响应或中断时可能带 `error` |

`Project`：

```ts
interface Project {
  id: string;
  full_name: string;
  name: string;
  description: string;
  html_url: string;
  stars: number;
  language: string | null;
  topics: string[];
  category: string;
  updated_at: string;
  match_score?: number;       // 当前查询的向量相似度
  matched_sections?: string[]; // 命中的 README 章节
}
```

引导模式不再以对话次数判断是否可以推荐。模型每轮输出隐藏的 `guided_state`，服务端只有在 `direction`、`background`、`requirements`、`constraints` 全部完成且上一轮已经确认 `ready` 时，才允许发送仓库卡片。调查期间即使正文意外出现仓库名，也不会触发项目事件。

服务端只加载向量检索命中的项目元数据，不执行每次请求的全表扫描。客户端取消请求时，取消信号会继续传递给上游 LLM 请求。

### 3.4 非流式错误

| HTTP 状态 | 场景 | 响应示例 |
|---:|---|---|
| 400 | 非法 JSON、空问题、超长问题、未知模式或分类 | `{ "error": "问题不能为空" }` |
| 503 | Supabase/RPC 不可用、数据未就绪、服务未配置 | `{ "error": "项目数据暂未就绪" }` |
| 502 | 上游 LLM 返回错误 | `{ "error": "服务繁忙，请稍后重试" }` |
| 499 | 请求由客户端取消 | `{ "error": "请求已取消" }` |
| 500 | 未分类的服务端异常 | `{ "error": "服务内部错误" }` |

## 4. Supabase 数据接口

初始化脚本：`scripts/supabase_init.sql`。表已启用 RLS，不为 `anon` 或普通 `authenticated` 角色配置直接读取策略；线上访问只经过服务端 service role 客户端。

### 4.1 `projects`

项目元数据表。主键为 12 位 MD5 派生 ID，`full_name` 唯一，`topics` 使用 JSONB。

### 4.2 `embedding_chunks`

README 文本块及 512 维向量。`repo_full_name` 与 `projects.full_name` 通过业务逻辑关联；当前没有数据库外键。

### 4.3 `match_chunks()`

```sql
match_chunks(
  query_embedding vector(512),
  match_count integer default 5,
  filter_category text default null
)
```

返回字段：`id`、`repo_full_name`、`category`、`section_title`、`chunk_index`、`text`、`score`。`score = 1 - cosine_distance`，结果按余弦距离升序排列。

函数内关闭了 HNSW `indexscan`，对当前数千条 chunk 执行精确扫描。这样可以避免近似索引先选取全局候选、再应用 `filter_category` 时，让 `Data & Training` 等较小分类错误返回空结果。已有 Supabase 项目需要执行 `scripts/fix_match_chunks_filtered.sql` 更新线上函数。

## 5. 静态数据契约

### 5.1 `public/trending.json`

数组，每项至少应包含：

```ts
interface TrendingItem {
  id: string;
  title: string;
  url: string;
  source: string;
  source_type: string;
  timestamp: string; // ISO 8601
  summary?: string;
  frontier?: number;
  signal?: number;
  score?: number;
  llm_summary?: string;
  llm_tags?: string[];
  stars?: number;
  language?: string;
}
```

文件由 `scripts/fetch_trending.py` 生成。前端不再重复执行评分门槛，只负责展示。

### 5.2 `public/changelog.json`

顶层包含 `announcement` 和 `entries`。公告类型允许 `info`、`warning`、`success`、`feature`；变更类型允许 `feature`、`fix`、`improvement`、`docs`、`removal`。

### 5.3 `public/projects.json`

本地参考快照，结构与 `Project[]` 一致。线上项目页面和对话接口以 Supabase 为数据源。

### 5.4 `content/records/**/*.md`

个人文章的唯一内容源。以下 Front Matter 字段可用：

| 字段 | 必需 | 说明 |
|---|---|---|
| `title` | 是 | 文章标题 |
| `date` | 是 | `YYYY-MM-DD`；用于排序和展示 |
| `summary` | 否 | 首页、记录列表和元数据摘要 |
| `tags` | 否 | 字符串数组；当前只展示，不筛选 |
| `featured` | 否 | `true` 时同时出现在档案页 |
| `draft` | 否 | `true` 时不会生成公开页面 |
| `cover` | 否 | 预留的站内图片路径 |

文件名以下划线开头时也不会被读取，因此 `_template.md` 可安全保留在目录中。

### 5.5 `content/profile.json`

档案页的个人事实来源，包含 `displayName`、`avatar`、`school`、`major`、`stage`、`intro`、`motto`、`links`、`bookmarks`、`competitions` 和 `githubProjects`。空的 `intro` 不渲染；比赛与 GitHub 项目中 `draft: true` 的模板项不会渲染。

- `competitions[]`：`title`、`date`、`image` 必需，`award`（奖项，可选）、`description`（可选）。证明图片建议放在 `public/profile/competitions/`。
- `githubProjects[]`：`name`、`description`、`href` 必需。

## 6. 外部服务契约

| 服务 | 调用位置 | 认证变量 | 用途 |
|---|---|---|---|
| Embedding（智谱） | `src/lib/rag.ts`、`build_rag_index.py` | `EMBEDDING_API_KEY`、`EMBEDDING_API_BASE` | 512 维查询/语料向量化 |
| LLM 对话（anthropic 兼容） | `/api/projects` | `LLM_API_KEY`、`LLM_API_BASE` | RAG 回答和结构化标签 |
| LLM 评分（anthropic 兼容） | `fetch_trending.py` | `LLM_API_KEY`、`LLM_API_BASE` | 热点评分与摘要 |
| Supabase | 服务端与构建脚本 | `SUPABASE_URL`、`SUPABASE_SERVICE_KEY` | 项目元数据和 pgvector |
| GitHub API | Python 管道 | `GITHUB_TOKEN` | 项目发现与 README 拉取 |
| Hitokoto | `src/lib/quotes.ts` | 无 | 首页名言；5 秒超时后本地降级 |
| RSS / HN Algolia | `fetch_trending.py` | 无 | 热点采集 |

LLM 与 Embedding 是两颗独立 Key（品牌不同）、可能不同账号；同账号时仍共享账户级限流额度。

当前 DeepSeek V4 对话请求显式传入 `thinking: { type: "disabled" }`。V4 默认开启思考模式；在 RAG 长提示与较小 `max_tokens` 下，可能只产生 `thinking_delta` 而没有可展示的 `text_delta`。项目推荐更依赖稳定正文和 `<project>` 结构化标签，因此使用非思考模式。

站内 RAG 默认单次输出上限为 4096 token、保留最近 30 条历史消息、每条最多 4000 字符。分别可通过 `RAG_MAX_OUTPUT_TOKENS`、`RAG_MAX_HISTORY_MESSAGES`、`RAG_MAX_HISTORY_MESSAGE_LENGTH` 调整。默认检索 8 个 chunk，最多渲染 6 个明确推荐的仓库，可通过 `RAG_MATCH_COUNT`、`RAG_MAX_CANDIDATE_CARDS` 调整。引导模式会把最近的用户回答合并为最多 6000 字符的检索查询，避免最后一句“开始推荐”稀释完整需求；窗口由 `RAG_RETRIEVAL_CONTEXT_LENGTH` 控制。

## 7. 兼容性与安全约束

- 不要在 Client Component 中导入 `src/lib/supabase.ts`。
- 不要把 `SUPABASE_SERVICE_KEY` 写入 `NEXT_PUBLIC_*` 变量。
- SSE 客户端必须容忍事件被拆包，并保留未完成行到下一次读取。
- LLM 返回的 `<project>`、`<options>`、`<suggestions>` 是内部渲染协议，不是可信 HTML；展示前会移除标签。
- `<project>` 是生成仓库卡片的唯一授权信号。正文中裸写、比较或否定某个仓库不会触发卡片，防止将“不推荐项”误渲染成结果。
- 当前接口尚未实现用户级限流。公开推广或访问量增长前，应增加 IP/会话级速率限制、调用预算和监控。
