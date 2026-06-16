# 代码 Review 记录

> 每次代码改动的 review 笔记：**时间 · 对象 · 思路 · 解决办法**。
> 最新在上。改完代码同步追加一条。

| 日期 | 对象 | 思路（为什么改） | 解决办法 |
|------|------|------------------|---------|
| 2026-06-16 | `fetch_hackernews` | HN 一直 `🔶 0 items`，两个叠加 bug：① query 带字面 "OR"+空格短语（"machine learning"）algolia 不认；② **algolia 多词 query 默认 AND**，`AI LLM GPT transformer` 4 词要求全含直接返回 0 条。返回的老帖全被本地 7 天窗口过滤光 | query 改 `AI LLM GPT transformer` + `optionalWords` 同值（多词默认 AND，optionalWords 才得 OR 语义）；points `>10`→`>5`；加服务端 `created_at_i>N天前` 时间约束。实测 0→15 条近 7 天高赞 |
| 2026-06-16 | ArXiv 选品 (`coarse_rank_arxiv`) | CI 偶发 `0/10` 通过，本地同一套逻辑却 `6/12`。诊断发现 `fetch_arxiv` 粗筛后**纯按时间**截断 top20——"最新 20 篇"质量随抓取时刻随机波动，有时恰好都是 60 分中庸论文 | 新增 `coarse_rank_arxiv`：按 `关键词命中 + has_code×3 + lab_match×4` 排序取 top20，精品优先。top20 有代码从 ~0 提升到 12/20、顶级实验室 4/20 |
| 2026-06-16 | `run_llm_pass_async`（可观测性） | 淘汰条目（❌）不打印分数，导致 `0/N` 这类异常无法诊断——此前黑箱，调门槛/prompt 全靠猜 | `process()` 返回 `accepted` 标记，❌ 行也打印 `F/S/综合` 分数；LLM 无返回时标 `(LLM无返回)` |
| 2026-06-16 | GitHub 高星直通车 (`OPENSOURCE_STAR_FAST_PATH`) | LLM 评分时看不到 `stars`，高星新仓库（如 ponytail ⭐1w+）连续被主观误杀，导致 GitHub 条目进不了库 | `stars ≥ 200` 的 GitHub 仓库绕过 LLM 直接入选，score 按 `log10(stars)` 映射（200→54，1万→90 封顶） |
| 2026-06-16 | GitHub timestamp 语义 | GitHub 条目用仓库 `created_at` 做 timestamp，因"创建时间 + 搜索索引延迟"系统性沉到时间线底部，用户看不到 GitHub 内容 | timestamp 改用**抓取时间**，与 ArXiv/Reddit 一样进最新分组；真实创建时间存 `created_at` 字段备查 |
| 2026-06-16 | GitHub 初筛 query | `AI OR LLM OR transformer` 的 "AI" 太宽泛（召回 ~11.4 万），捞进大量蹭热度的写作/插画/statusline 项目 | 改 `LLM OR GPT OR transformer`（去 "AI"），召回降到 ~1.5 万。⚠️ GitHub Search 限制：`topic:` 等 qualifier 不能 OR、最多 5 个 AND/OR，只能用关键词 OR |
| 2026-06-16 | `MAX_AGE_DAYS` | 5 天保留窗口偏短，放宽 | 5→7，三处同步：`fetch_trending.py` 默认值、`.github/workflows/trending.yml`、本地 `.env` |
| 2026-06-16 | `fetch_github_trending`（撤回） | 此前为防 CI runner IP 限流加的鉴权 + 403 退避重试，但日志证明从未限流、改动没起作用 | 撤回原样，保持简单（无 Token 也能跑） |

## 本轮（2026-06-16）数据源健康结论

| 源 | 状态 | 说明 |
|----|------|------|
| ArXiv cs.AI / cs.CL | ✅ | 粗筛 pass 89/96，选品后 top20 精品优先 |
| GitHub | ✅ | 新 query 稳定 20 条，高星直通车保证入库 |
| OpenAI Blog | ✅ | 正常 |
| Hugging Face / MIT Tech Review | ⚠️ 本地 | 本地网络访问异常（被墙），CI 国外 runner 正常 |
| Reddit ×5 | ⚠️ 本地 | 同上，本地全部异常，CI 部分有内容 |
| HackerNews | ✅ 已修复 | 修了 query 写法 bug，从 0 items → 近 7 天高赞故事 |

**结论**：代码层面所有源均已 OK。HF / MIT / Reddit 的"异常"是中国本地网络的墙问题，CI（国外 runner）不受影响——线上数据由 CI 产出，所以线上不受影响。
