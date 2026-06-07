export default function SuggestedQuestions({
  items,
  onSelect,
  layout = 'horizontal',
}: {
  items: string[];
  onSelect: (q: string) => void;
  layout?: 'horizontal' | 'grid';
}) {
  if (items.length === 0) return null;

  return (
    <div className={
      layout === 'grid'
        ? 'grid grid-cols-2 gap-2 mt-3'
        : 'flex gap-2 mt-3 chips-scroll overflow-x-auto pb-1'
    }>
      {items.map((item, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(item)}
          className={`glass-btn-outline px-4 py-2.5 text-sm text-left transition-all hover-lift ${
            layout === 'grid' ? 'whitespace-normal' : 'whitespace-nowrap'
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
