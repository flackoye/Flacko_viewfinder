export interface Phase {
  id: number;
  title: string;
  status: 'completed' | 'active' | 'locked';
}

interface PhaseTrackerProps {
  phases: Phase[];
  variant?: 'default' | 'guided';
  direction?: 'horizontal' | 'vertical';
}

export default function PhaseTracker({
  phases,
  variant = 'default',
  direction = 'horizontal',
}: PhaseTrackerProps) {
  const isKlein = variant === 'guided';
  const activeColor = isKlein ? 'klein' : 'accent';

  if (direction === 'vertical') {
    return (
      <div className="flex flex-col items-start gap-0">
        {phases.map((phase, idx) => (
          <div key={phase.id} className="relative flex items-start gap-3 pb-4">
            {/* 竖向连接线 */}
            {idx < phases.length - 1 && (
              <div className="absolute left-[11px] top-[28px] bottom-0 w-[2px] bg-border" />
            )}

            {/* 状态圆点 */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 z-10 ${
              phase.status === 'completed'
                ? `bg-${activeColor}/20 text-${activeColor} border border-${activeColor}/40`
                : phase.status === 'active'
                  ? `bg-${activeColor}/15 text-${activeColor} border-2 border-${activeColor}/60`
                  : 'bg-bg-card text-text-dim border border-border'
            }`}>
              {phase.status === 'completed' ? '✓' : phase.status === 'active' ? '●' : '○'}
            </div>

            {/* Phase 标题 */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className={`text-sm font-medium ${
                phase.status === 'completed'
                  ? `text-${activeColor} line-through decoration-${activeColor}/30`
                  : phase.status === 'active'
                    ? `text-${activeColor}`
                    : 'text-text-dim'
              }`}>
                Phase {phase.id}: {phase.title}
              </span>
              {phase.status === 'active' && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full bg-${activeColor}/10 text-${activeColor} border border-${activeColor}/20`}>
                  进行中
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 水平模式
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {phases.map((phase, idx) => (
        <div key={phase.id} className="flex items-center gap-2">
          {idx > 0 && <div className="w-6 h-[2px] bg-border shrink-0" />}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all duration-300 ${
            phase.status === 'completed'
              ? `bg-${activeColor}/10 text-${activeColor} border border-${activeColor}/25`
              : phase.status === 'active'
                ? `bg-${activeColor}/15 text-${activeColor} border border-${activeColor}/40 shadow-sm shadow-${activeColor}/10`
                : 'bg-bg-card text-text-dim border border-border'
          }`}>
            <span className="text-[10px]">
              {phase.status === 'completed' ? '✓' : phase.status === 'active' ? '●' : '○'}
            </span>
            <span className="font-medium">{phase.title}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
