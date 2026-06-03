/**
 * 每日一言 — 一言（Hitokoto）API + 本地备用
 */

export interface Quote {
  text: string;
  author?: string;
  from?: string;
}

// 本地备用名言 — API 挂了就用这些
const fallbackQuotes: Quote[] = [
  { text: '所谓无底深渊，下去也是前程万里。', author: '木心' },
  { text: '从前的日色变得慢，车马邮件都慢，一生只够爱一个人。', author: '木心' },
  { text: '我行过许多地方的桥，看过许多次数的云，喝过许多种类的酒，却只爱过一个正当最好年龄的人。', author: '沈从文' },
  { text: '一个人只拥有此生此世是不够的，他还应该拥有诗意的世界。', author: '王小波' },
  { text: '如果有来生，要做一棵树，站成永恒，没有悲欢的姿势。', author: '三毛' },
  { text: '黑夜给了我黑色的眼睛，我却用它寻找光明。', author: '顾城' },
  { text: '你来人间一趟，你要看看太阳。', author: '海子' },
  { text: '凡是过往，皆为序章。', author: '莎士比亚' },
  { text: 'Not all those who wander are lost.', author: 'J.R.R. Tolkien' },
  { text: 'We are all in the gutter, but some of us are looking at the stars.', author: 'Oscar Wilde' },
  { text: 'Be yourself; everyone else is already taken.', author: 'Oscar Wilde' },
  { text: 'Everything you can imagine is real.', author: 'Pablo Picasso' },
];

/**
 * 从一言 API 获取一条名言
 * 可以在服务端或客户端调用
 */
export async function fetchQuote(): Promise<Quote> {
  try {
    // 加 5 秒超时，防止 API 卡住导致页面一直 loading
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('https://v1.hitokoto.cn/?c=d&c=h&c=i&c=k', {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error('API 请求失败');

    const data = await res.json();

    return {
      text: data.hitokoto || '',
      author: data.from_who || undefined,
      from: data.from || undefined,
    };
  } catch {
    // API 挂了 / 超时 → 用本地备用
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    return fallbackQuotes[seed % fallbackQuotes.length];
  }
}
