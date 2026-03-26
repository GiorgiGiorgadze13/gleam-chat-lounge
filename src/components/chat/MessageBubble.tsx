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
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
  ];
  const colorIdx = (profile?.username?.charCodeAt(0) ?? 0) % colors.length;

  return (
    <div
      className={cn(
        'group relative rounded-lg px-3 py-1 transition-colors hover:bg-muted/50',
        showAuthor && 'mt-4 pt-2'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Reply reference */}
      {repliedMessage && (
        <div className="mb-1 flex items-center gap-1.5 pl-10 text-xs">
          <div className="h-3 w-0.5 rounded-full bg-primary/40" />
          <Reply className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium text-primary/70">{repliedProfile?.username ?? 'Unknown'}</span>
          <span className="truncate text-muted-foreground">{repliedMessage.content}</span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        {showAuthor ? (
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm',
            colors[colorIdx]
          )}>
            {initial}
          </div>
        ) : (
          <div className="w-9 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          {showAuthor && (
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-foreground">
                {profile?.username ?? 'Unknown'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {format(new Date(message.created_at), 'h:mm a')}
              </span>
            </div>
          )}

          {editing ? (
            <div className="mt-1 flex items-center gap-1.5">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                  if (e.key === 'Escape') setEditing(false);
                }}
                autoFocus
                rows={1}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={handleSaveEdit}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
              {message.content}
              {message.is_edited && (
                <span className="ml-1.5 text-[10px] italic text-muted-foreground">(edited)</span>
              )}
            </p>
          )}
        </div>

        {/* Actions */}
        {hovered && !editing && (
          <div className="absolute -top-3 right-2 flex items-center gap-0.5 rounded-lg border bg-card px-1 py-0.5 shadow-sm">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onReply} title="Reply">
              <Reply className="h-3 w-3" />
            </Button>
            {isOwn && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditContent(message.content); setEditing(true); }} title="Edit">
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            {(isOwn || isAdmin) && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDelete(message.id)} title="Delete">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
