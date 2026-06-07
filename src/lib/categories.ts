/** 7 个 AI 项目分类 — 落地页和引导模式共享 */

export interface CategoryMeta {
  name: string;
  emoji: string;
  label: string;
  description: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { name: 'Agent', emoji: '🤖', label: 'AI Agent', description: '智能体框架与自主决策系统' },
  { name: 'LLM', emoji: '🧠', label: '大语言模型', description: 'LLM 推理、微调与部署工具' },
  { name: 'RAG', emoji: '🔍', label: 'RAG', description: '检索增强生成与知识库构建' },
  { name: 'Prompt Engineering', emoji: '✨', label: 'Prompt 工程', description: '提示词优化与模板管理' },
  { name: 'Diffusion', emoji: '🎨', label: '图像生成', description: '扩散模型与图像/视频生成' },
  { name: 'Vector DB', emoji: '💾', label: '向量数据库', description: '向量存储与高效检索引擎' },
  { name: 'Data & Training', emoji: '📊', label: '数据与训练', description: '数据集构建与模型训练流程' },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.name, c]));
