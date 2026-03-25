import { useState } from 'react';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Reply, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

  return (
    <div
      className={cn('group relative px-2 py-0.5', showAuthor && 'mt-3')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Reply reference */}
      {repliedMessage && (
        <div className="mb-1 flex items-center gap-1 pl-8 text-xs text-muted-foreground">
          <Reply className="h-3 w-3" />
          <span className="font-mono font-medium">{repliedProfile?.username ?? 'Unknown'}</span>
          <span className="truncate max-w-[200px]">{repliedMessage.content}</span>
        </div>
      )}

      <div className="flex gap-2">
        {/* Avatar placeholder */}
        {showAuthor ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
            {(profile?.username?.[0] ?? '?').toUpperCase()}
          </div>
        ) : (
          <div className="w-8 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          {showAuthor && (
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-semibold text-foreground">
                {profile?.username ?? 'Unknown'}
              </span>
              <span className="text-[10px] text-chat-timestamp">
                {format(new Date(message.created_at), 'HH:mm')}
              </span>
            </div>
          )}

          {editing ? (
            <div className="flex items-center gap-1 mt-0.5">
              <Input
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="h-7 text-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {message.content}
              {message.is_edited && (
                <span className="ml-1 text-[10px] text-muted-foreground">(edited)</span>
              )}
            </p>
          )}
        </div>

        {/* Actions */}
        {hovered && !editing && (
          <div className="flex items-start gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onReply} title="Reply">
              <Reply className="h-3 w-3" />
            </Button>
            {isOwn && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditContent(message.content); setEditing(true); }} title="Edit">
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            {(isOwn || isAdmin) && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(message.id)} title="Delete">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
