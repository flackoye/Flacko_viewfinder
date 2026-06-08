import type { EmbeddingChunk, ChatMessage, Project } from './project-types';

const ZHIPU_API_BASE = 'https://open.bigmodel.cn/api/paas/v4';

// ─── Embedding ───

/** 带指数退避重试的 fetch 封装（429/5xx 感知） */
export async function fetchWithRetry(
  url: string, init: RequestInit,
  maxRetries = 2, baseDelay = 500,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      // 429 限流或 5xx 服务端错误 → 重试
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

/** 调用 ZhipuAI Embedding API 向量化查询 */
export async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error('ZHIPU_API_KEY not configured');

  const res = await fetchWithRetry(`${ZHIPU_API_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'embedding-3',
      input: text,
      dimensions: 512,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// ─── Prompt 构建 ───

/** 格式化检索 chunk 为文本 */
function formatChunks(chunks: EmbeddingChunk[], projects: Project[]): string {
  return chunks.map(c => {
    const project = projects.find(p => p.full_name === c.repo_full_name);
    const projectInfo = project
      ? `【${project.full_name}】⭐${project.stars} | ${project.description || '无描述'} | 语言: ${project.language || '未知'} | 分类: ${project.category}`
      : `【${c.repo_full_name}】`;
    return `--- ${projectInfo} ---\n章节: ${c.section_title}\n${c.text}`;
  }).join('\n\n');
}

/** 格式化对话历史 */
function formatHistory(history: ChatMessage[]): string {
  return history.length > 0
    ? history.map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`).join('\n\n')
    : '（这是对话的开始）';
}

/** 引导模式系统 Prompt — 深度个体化引导 */
const GUIDED_SYSTEM_PROMPT = `你是「万象索骥」引导式项目导航员。你的核心任务是：通过多轮深度对话，逐步建立对用户个体化需求的理解画像，最终精准推荐最适合的 AI 开源项目。

⚠️ 核心原则：宁可多问一轮，不可草率推荐。你必须在完成以下四个维度调查后才能推荐项目。

═══ 引导流程（严格按顺序递进）═══

**第 1 轮：方向确认**
用户已选择一个技术分类。你需要：
- 简要介绍这个分类的核心内容和当前生态
- 给出 3-4 个具体子方向供选择

**第 2 轮：背景调查**
了解用户的技术画像：
- 经验水平（初学/有经验/资深？）
- 技术栈偏好（Python/JS/Go/Rust？）
- 使用场景（学习研究/个人项目/企业生产？）

**第 3 轮：需求细化**
深入理解核心需求：
- 具体想实现什么功能或解决什么问题？
- 对规模/性能/易用性有什么要求？
- 有没有特定的部署环境限制？

**第 4 轮：约束确认**
确认关键决策因素：
- 是否需要中文文档/社区支持？
- 团队协作需求（个人/小团队/大团队？）
- 对许可证有要求吗？

**第 5 轮+：精准推荐**
只有当你认为已充分理解用户时才推荐：
- 先用一段话总结你对用户需求画像的理解
- 然后推荐 2-3 个最适合的项目，说明推荐理由

═══ 输出格式（严格遵守）═══
- 中文回答，技术术语保留英文
- 只推荐检索结果中真实存在的项目
- 每轮给出 3-4 个选项（用 <options> 标签，JSON 数组）：
  <options>
  ["选项1", "选项2", "选项3"]
  </options>
- ⚠️ 推荐项目时必须用 <project> 标签包裹全名，否则无法渲染卡片：
  正确: <project>facebookresearch/AugLy</project>
  错误: facebookresearch/AugLy（裸写不生效！）
  每个推荐项目都必须单独用 <project> 标签包裹，不要遗漏。
- 追问建议用 <suggestions>["a","b"]</suggestions>

═══ 关键规则 ═══
- 前 4 轮绝对不能推荐项目，只能提问和引导
- 每轮只问一个维度的问题，不要一次问太多
- 选项要具体、有区分度，不要泛泛而谈
- 如果用户回答模糊，追问澄清而不是跳过
- 推荐时要结合前面所有轮次的信息，体现个体化`;

/** 助手模式系统 Prompt */
const ASSISTANT_SYSTEM_PROMPT = `你是「万象索骥」AI 项目助手。直接回答用户关于 AI 开源项目的问题。

输出格式（严格遵守）：
- 中文回答，技术术语保留英文
- 只推荐检索结果中真实存在的项目
- ⚠️ 推荐项目时必须用 <project> 标签包裹全名，否则无法渲染卡片：
  正确: <project>facebookresearch/AugLy</project>
  错误: facebookresearch/AugLy（裸写不生效！）
  每个推荐项目都必须单独用 <project> 标签包裹，不要遗漏。
- 回答末尾用 <suggestions> 标签给追问建议：
  <suggestions>
  ["追问1", "追问2"]
  </suggestions>`;

/** 旧版兼容 Prompt（苏格拉底式） */
const SOCRATIC_SYSTEM_PROMPT = `你是「Flacko的取景框」AI 项目导航员。像导师一样引导用户找到最适合的 AI 开源项目。

对话策略：
1. 用户需求模糊 → 不列项目，先问方向 → 给 2-3 个方向选项
2. 有大致方向但不够具体 → 进一步缩小
3. 需求明确 → 直接推荐，说明适用场景
4. 每次回答附带 2-3 个追问建议

输出格式：
- 中文回答，技术术语保留英文
- 只推荐检索结果中真实存在的项目
- 推荐项目用 <project>owner/repo</project>
- 追问建议用 <suggestions>["a","b"]</suggestions>`;

/** 构建引导模式 Prompt */
export function buildGuidedPrompt(
  history: ChatMessage[],
  question: string,
  chunks: EmbeddingChunk[],
  projects: Project[],
  category?: string,
): string {
  const categoryNote = category ? `\n当前选择的分类：${category}` : '';
  return `${GUIDED_SYSTEM_PROMPT}

对话历史：
${formatHistory(history)}${categoryNote}

检索到的项目片段：
${formatChunks(chunks, projects)}

用户说：${question}`;
}

/** 构建助手模式 Prompt */
export function buildAssistantPrompt(
  history: ChatMessage[],
  question: string,
  chunks: EmbeddingChunk[],
  projects: Project[],
): string {
  return `${ASSISTANT_SYSTEM_PROMPT}

对话历史：
${formatHistory(history)}

检索到的项目片段：
${formatChunks(chunks, projects)}

用户说：${question}`;
}

/** 旧版兼容：苏格拉底式 Prompt */
export function buildSocraticPrompt(
  history: ChatMessage[],
  question: string,
  chunks: EmbeddingChunk[],
  projects: Project[],
): string {
  return `${SOCRATIC_SYSTEM_PROMPT}

对话历史：
${formatHistory(history)}

检索到的项目片段：
${formatChunks(chunks, projects)}

用户说：${question}`;
}

// ─── 标签解析 ───

/** 解析 <options> 标签 */
export function parseOptions(text: string): string[] {
  const match = text.match(/<options>\s*([\s\S]*?)\s*<\/options>/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1].trim());
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

/** 解析 <suggestions> 标签 */
export function parseSuggestions(text: string): string[] {
  const match = text.match(/<suggestions>\s*([\s\S]*?)\s*<\/suggestions>/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1].trim());
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

/** 解析 <project> 标签 */
export function parseProjectRefs(text: string): string[] {
  const matches = text.matchAll(/<project>(.*?)<\/project>/g);
  return [...new Set([...matches].map(m => m[1].trim()))];
}

/** 从显示文本中移除所有标签 */
export function stripTags(text: string): string {
  return text
    .replace(/<options>[\s\S]*?<\/options>/g, '')
    .replace(/<suggestions>[\s\S]*?<\/suggestions>/g, '')
    .replace(/<\/?project>/g, '')
    .trim();
}
