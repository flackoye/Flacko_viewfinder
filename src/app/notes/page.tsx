import { BookOpen } from 'lucide-react';
import NoteLayout from '@/components/NoteLayout';
import { getNotesTree, getAllNotes } from '@/lib/notes';

export default function NotesPage() {
  const tree = getNotesTree();
  const allNotes = getAllNotes();

  return (
    <NoteLayout tree={tree}>
      <div className="max-w-3xl">
        <h1 className="text-4xl font-bold mb-3">
          <span className="gradient-text">笔记</span>
        </h1>
        <p className="text-text-muted mb-10">
          学习过程中的思考、推导和理解记录
        </p>

        {allNotes.length === 0 ? (
          <div className="text-center py-20 text-text-dim">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg mb-2">还没有笔记</p>
            <p className="text-sm">在 <code className="px-1.5 py-0.5 rounded bg-white/5 text-accent text-xs">content/notes/</code> 目录下添加 .md 文件即可</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allNotes.map((note) => (
              <a
                key={note.slug.join('/')}
                href={`/notes/${note.slug.join('/')}`}
                className="glass p-5 flex items-center gap-4 group hover-lift block"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text group-hover:text-accent transition-colors">
                    {note.title}
                  </h3>
                  <p className="text-xs text-text-dim mt-1">
                    {note.slug.slice(0, -1).join(' / ')}
                  </p>
                </div>
                {note.date && (
                  <span className="text-xs text-text-dim shrink-0">{note.date}</span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </NoteLayout>
  );
}
