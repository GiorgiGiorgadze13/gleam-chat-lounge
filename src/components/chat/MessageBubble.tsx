import { useState } from 'react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Reply, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Message = Tables<'messages'>;
type Profile = Tables<'profiles'>;

interface MessageBubbleProps {
  message: Message;
  profile?: Profile;
  isOwn: boolean;
  showAuthor: boolean;
  isAdmin: boolean;
  repliedMessage?: Message | null;
  repliedProfile?: Profile;
  onReply: () => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-emerald-500', 'bg-orange-500', 'bg-sky-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
];

export function MessageBubble({
  message, profile, isOwn, showAuthor, isAdmin,
  repliedMessage, repliedProfile, onReply, onEdit, onDelete,
}: MessageBubbleProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [hovered, setHovered] = useState(false);

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      onEdit(message.id, editContent.trim());
      setEditing(false);
    }
  };

  const initial = (profile?.username?.[0] ?? '?').toUpperCase();
  const colorIdx = (profile?.username?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length;

  return (
    <div
      className={cn(
        'group relative rounded-lg px-3 py-0.5 transition-colors hover:bg-muted/40',
        showAuthor && 'mt-3 pt-1.5'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {repliedMessage && (
        <div className="mb-0.5 flex items-center gap-1.5 pl-10 text-[11px]">
          <div className="h-3 w-0.5 rounded-full bg-primary/30" />
          <Reply className="h-2.5 w-2.5 text-muted-foreground" />
          <span className="font-medium text-primary/70">{repliedProfile?.username ?? 'Unknown'}</span>
          <span className="truncate text-muted-foreground">{repliedMessage.content}</span>
        </div>
      )}

      <div className="flex gap-2.5">
        {showAuthor ? (
          <div className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white',
            AVATAR_COLORS[colorIdx]
          )}>
            {initial}
          </div>
        ) : (
          <div className="w-8 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          {showAuthor && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13px] font-semibold text-foreground">
                {profile?.username ?? 'Unknown'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(message.created_at), 'h:mm a')}
              </span>
            </div>
          )}

          {editing ? (
            <div className="mt-1 flex items-center gap-1">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                  if (e.key === 'Escape') setEditing(false);
                }}
                autoFocus
                rows={1}
              />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={handleSaveEdit}>
                <Check className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
              {message.content}
              {message.is_edited && (
                <span className="ml-1 text-[10px] italic text-muted-foreground">(edited)</span>
              )}
            </p>
          )}
        </div>

        {hovered && !editing && (
          <div className="absolute -top-2.5 right-2 flex items-center gap-0.5 rounded-md border bg-card px-0.5 py-0.5 shadow-sm">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onReply} title="Reply">
              <Reply className="h-3 w-3" />
            </Button>
            {isOwn && (
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditContent(message.content); setEditing(true); }} title="Edit">
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            {(isOwn || isAdmin) && (
              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => onDelete(message.id)} title="Delete">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
