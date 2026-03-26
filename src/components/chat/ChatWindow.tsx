import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tables } from '@/integrations/supabase/types';
import { MessageInput } from './MessageInput';
import { MessageBubble } from './MessageBubble';
import { Button } from '@/components/ui/button';
import { LogOut, ChevronUp, Hash } from 'lucide-react';
import { toast } from 'sonner';

type Room = Tables<'rooms'>;
type Message = Tables<'messages'>;
type Profile = Tables<'profiles'>;

interface ChatWindowProps {
  room: Room;
  onLeaveRoom: (roomId: string) => void;
  onRoomsChanged: () => void;
}

const PAGE_SIZE = 50;

export function ChatWindow({ room, onLeaveRoom, onRoomsChanged }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [myRole, setMyRole] = useState<string>('member');

  useEffect(() => {
    setMessages([]);
    setProfiles({});
    setReplyTo(null);
    loadMessages();
    loadMyRole();

    const channel = supabase
      .channel(`room-${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
        loadProfile(msg.user_id);
        if (isAtBottomRef.current) {
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        const old = payload.old as { id: string };
        setMessages(prev => prev.filter(m => m.id !== old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room.id]);

  const loadMyRole = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', room.id)
      .eq('user_id', user.id)
      .single();
    if (data) setMyRole(data.role);
  };

  const loadProfile = async (userId: string) => {
    if (profiles[userId]) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfiles(prev => ({ ...prev, [userId]: data }));
  };

  const loadMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (data) {
      const sorted = data.reverse();
      setMessages(sorted);
      setHasMore(data.length === PAGE_SIZE);

      const userIds = [...new Set(sorted.map(m => m.user_id))];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        if (profileData) {
          const map: Record<string, Profile> = {};
          profileData.forEach(p => { map[p.id] = p; });
          setProfiles(map);
        }
      }

      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 50);
    }
    setLoading(false);
  };

  const loadOlderMessages = async () => {
    if (!hasMore || loading || messages.length === 0) return;
    const oldest = messages[0];
    setLoading(true);

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', room.id)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (data) {
      const sorted = data.reverse();
      setMessages(prev => [...sorted, ...prev]);
      setHasMore(data.length === PAGE_SIZE);

      const newUserIds = [...new Set(sorted.map(m => m.user_id))].filter(id => !profiles[id]);
      if (newUserIds.length > 0) {
        const { data: pData } = await supabase.from('profiles').select('*').in('id', newUserIds);
        if (pData) {
          setProfiles(prev => {
            const map = { ...prev };
            pData.forEach(p => { map[p.id] = p; });
            return map;
          });
        }
      }
    }
    setLoading(false);
  };

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (el.scrollTop < 100 && hasMore && !loading) {
      loadOlderMessages();
    }
  };

  const handleSend = async (content: string) => {
    if (!user || !content.trim()) return;
    const { error } = await supabase.from('messages').insert({
      room_id: room.id,
      user_id: user.id,
      content: content.trim(),
      reply_to_id: replyTo?.id ?? null,
    });
    if (error) {
      toast.error('Failed to send: ' + error.message);
      console.error('Send message error:', error);
    }
    setReplyTo(null);
  };

  const handleEdit = async (messageId: string, content: string) => {
    const { error } = await supabase.from('messages').update({ content, is_edited: true }).eq('id', messageId);
    if (error) toast.error('Failed to edit');
  };

  const handleDelete = async (messageId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) toast.error('Failed to delete');
  };

  const isOwner = room.owner_id === user?.id;
  const isAdmin = myRole === 'admin' || myRole === 'owner';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b bg-card px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold text-foreground truncate">{room.name}</h3>
          {room.description && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <p className="truncate text-xs text-muted-foreground">{room.description}</p>
            </>
          )}
        </div>
        {!isOwner && !room.is_personal && (
          <Button variant="ghost" size="sm" onClick={() => onLeaveRoom(room.id)} className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1">
            <LogOut className="h-3 w-3" />
            Leave
          </Button>
        )}
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin"
      >
        {loading && messages.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">Loading messages...</p>
        )}
        {hasMore && messages.length > 0 && (
          <div className="py-2 text-center">
            <Button variant="ghost" size="sm" onClick={loadOlderMessages} disabled={loading} className="h-7 gap-1 text-xs">
              <ChevronUp className="h-3 w-3" />
              Load older
            </Button>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
              <p className="mt-1 text-xs text-muted-foreground/60">Be the first to say something!</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          const prevMsg = i > 0 ? messages[i - 1] : null;
          const showAuthor = !prevMsg || prevMsg.user_id !== msg.user_id;
          const repliedMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              profile={profiles[msg.user_id]}
              isOwn={msg.user_id === user?.id}
              showAuthor={showAuthor}
              isAdmin={isAdmin}
              repliedMessage={repliedMsg}
              repliedProfile={repliedMsg ? profiles[repliedMsg.user_id] : undefined}
              onReply={() => setReplyTo(msg)}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput
        onSend={handleSend}
        replyTo={replyTo}
        replyProfile={replyTo ? profiles[replyTo.user_id] : undefined}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
