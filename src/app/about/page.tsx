export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 min-h-[calc(100vh-10rem)] flex flex-col">
      {/* 核心身份 */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
          <span className="gradient-text">Cuhk_Chasing</span>
        </h1>

        <p className="text-lg md:text-2xl text-text-muted">
          <span className="text-accent font-medium">Bohao Fang</span>
          <span className="text-text-dim mx-2">·</span>
          <span className="text-accent font-medium">CUMT · CS</span>
          <span className="text-text-dim mx-2">·</span>
          大二在读
        </p>
      </div>
      {/* 简介 */}
      <section className="mb-12">
        <p className="text-text-muted leading-relaxed text-base md:text-[22px]">
         努力为网站接入自己的知识库中.....
        </p>
      </section>

      {/* 技术栈 — 推到底部 */}
      <section className="mt-auto pt-12">
        <h2 className="text-sm text-text-dim uppercase tracking-widest mb-4">技术栈</h2>
        <div className="flex flex-wrap gap-2">
          {['Python', 'C/C++', 'NumPy', 'TypeScript', 'React', 'Next.js', 'Tailwind CSS'].map((tech) => (
            <span key={tech} className="tag">{tech}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
