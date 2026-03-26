import { useState, useRef, useEffect } from 'react';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Send, X, Reply } from 'lucide-react';

type Message = Tables<'messages'>;
type Profile = Tables<'profiles'>;

interface MessageInputProps {
  onSend: (content: string) => void;
  replyTo: Message | null;
  replyProfile?: Profile;
  onCancelReply: () => void;
}

export function MessageInput({ onSend, replyTo, replyProfile, onCancelReply }: MessageInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const handleSubmit = () => {
    if (!content.trim()) return;
    if (new Blob([content]).size > 3072) {
      alert('Message too long (max 3 KB)');
      return;
    }
    onSend(content);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t bg-card px-4 py-2.5">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-1.5 text-xs">
          <Reply className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground">Replying to</span>
          <span className="font-semibold text-primary">{replyProfile?.username ?? 'Unknown'}</span>
          <span className="flex-1 truncate text-muted-foreground">{replyTo.content}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onCancelReply}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-input bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring/30"
          style={{ maxHeight: '120px', minHeight: '38px' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
          }}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="h-[38px] w-[38px] rounded-xl"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
