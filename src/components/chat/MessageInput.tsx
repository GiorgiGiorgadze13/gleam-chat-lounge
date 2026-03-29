import { useState, useRef, useEffect } from 'react';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Send, X, Reply, Paperclip, Image, FileText } from 'lucide-react';

type Message = Tables<'messages'>;
type Profile = Tables<'profiles'>;

export interface PendingFile {
  file: File;
  preview?: string;
}

interface MessageInputProps {
  onSend: (content: string, files: PendingFile[]) => void;
  replyTo: Message | null;
  replyProfile?: Profile;
  onCancelReply: () => void;
  uploading?: boolean;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_FILES = 5;

export function MessageInput({ onSend, replyTo, replyProfile, onCancelReply, uploading }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    };
  }, [files]);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    const valid: PendingFile[] = [];

    for (const file of arr) {
      if (files.length + valid.length >= MAX_FILES) {
        alert(`Maximum ${MAX_FILES} files per message`);
        break;
      }
      const isImage = file.type.startsWith('image/');
      const limit = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
      if (file.size > limit) {
        alert(`${file.name} is too large (max ${isImage ? '3MB for images' : '20MB for files'})`);
        continue;
      }
      valid.push({
        file,
        preview: isImage ? URL.createObjectURL(file) : undefined,
      });
    }
    setFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (idx: number) => {
    setFiles(prev => {
      const f = prev[idx];
      if (f.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = () => {
    if (!content.trim() && files.length === 0) return;
    if (content.trim() && new Blob([content]).size > 3072) {
      alert('Message too long (max 3 KB)');
      return;
    }
    onSend(content, files);
    setContent('');
    setFiles([]);
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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative group rounded-lg border bg-muted/30 overflow-hidden">
              {f.preview ? (
                <img src={f.preview} alt={f.file.name} className="h-16 w-16 object-cover" />
              ) : (
                <div className="flex h-16 w-28 flex-col items-center justify-center gap-0.5 px-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="truncate text-[9px] text-muted-foreground w-full text-center">{f.file.name}</span>
                  <span className="text-[8px] text-muted-foreground/60">{formatSize(f.file.size)}</span>
                </div>
              )}
              <button
                onClick={() => removeFile(i)}
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-[38px] w-[38px] rounded-xl text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Attach files"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? 'Uploading...' : 'Type a message...'}
          rows={1}
          disabled={uploading}
          className="flex-1 resize-none rounded-xl border border-input bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring/30 disabled:opacity-50"
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
          disabled={(!content.trim() && files.length === 0) || uploading}
          className="h-[38px] w-[38px] rounded-xl"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
