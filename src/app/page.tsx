import { fetchQuote } from '@/lib/quotes';
import HomeContent from '@/components/HomeContent';

export default async function Home() {
  // 服务端获取名言 — 用户打开页面就能看到，不会闪烁
  const initialQuote = await fetchQuote();

  return <HomeContent initialQuote={initialQuote} />;
}
