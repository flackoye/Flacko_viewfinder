'use client';

export interface OptionItem {
  label: string;
  value?: string;  // 选中时返回的值，不提供则用 label
  description?: string;
  emoji?: string;
  badge?: string;
}

interface OptionTableProps {
  options: OptionItem[];
  selectedValue?: string | null;
  onSelect: (value: string) => void;
}

export default function OptionTable({
  options,
  selectedValue,
  onSelect,
}: OptionTableProps) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const val = opt.value ?? opt.label;
        const isSelected = selectedValue === val;
        return (
          <button
            key={opt.label}
            onClick={() => onSelect(val)}
            className={`option-row group ${isSelected ? 'selected' : ''}`}
          >
            {/* Klein Blue 选中按钮 */}
            <span className={`option-btn ${isSelected ? 'selected' : 'group-hover:border-white/30'}`} />

            {/* Emoji */}
            {opt.emoji && (
              <span className="text-lg shrink-0">{opt.emoji}</span>
            )}

            {/* 文本内容 */}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-text block">{opt.label}</span>
              {opt.description && (
                <span className="text-xs text-text-dim block mt-0.5 truncate">{opt.description}</span>
              )}
            </div>

            {/* 数量徽章 */}
            {opt.badge && (
              <span className="tag text-[10px] shrink-0">{opt.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
