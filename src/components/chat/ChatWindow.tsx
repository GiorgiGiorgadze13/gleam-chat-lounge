import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tables } from '@/integrations/supabase/types';
import { MessageInput, PendingFile } from './MessageInput';
import { MessageBubble } from './MessageBubble';
import { CallButton } from './CallButton';
import { Button } from '@/components/ui/button';
import { LogOut, ChevronUp, Hash, Settings2 } from 'lucide-react';
import { RoomAdminDialog } from './RoomAdminDialog';
import { toast } from 'sonner';
import type { CallType } from '@/hooks/useWebRTC';

type Room = Tables<'rooms'>;
type Message = Tables<'messages'>;
type Profile = Tables<'profiles'>;
type Attachment = Tables<'message_attachments'>;

interface ChatWindowProps {
  room: Room;
  onLeaveRoom: (roomId: string) => void;
  onRoomsChanged: () => void;
  onStartCall: (targetUserId: string, targetUsername: string, roomId: string, type: CallType) => void;
}

const PAGE_SIZE = 50;

export function ChatWindow({ room, onLeaveRoom, onRoomsChanged, onStartCall }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [myRole, setMyRole] = useState<string>('member');
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    setMessages([]);
    setProfiles({});
    setAttachments({});
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
        loadAttachmentsForMessages([msg.id]);
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

  const loadAttachmentsForMessages = async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    const { data } = await supabase
      .from('message_attachments')
      .select('*')
      .in('message_id', messageIds);
    if (data && data.length > 0) {
      setAttachments(prev => {
        const next = { ...prev };
        data.forEach(att => {
          if (!next[att.message_id]) next[att.message_id] = [];
          // Avoid duplicates
          if (!next[att.message_id].find(a => a.id === att.id)) {
            next[att.message_id] = [...next[att.message_id], att];
          }
        });
        return next;
      });
    }
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

      // Load attachments for all loaded messages
      loadAttachmentsForMessages(sorted.map(m => m.id));

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

      loadAttachmentsForMessages(sorted.map(m => m.id));
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

  const handleSend = async (content: string, files: PendingFile[]) => {
    if (!user || (!content.trim() && files.length === 0)) return;

    // Insert the message first
    const { data: msgData, error } = await supabase.from('messages').insert({
      room_id: room.id,
      user_id: user.id,
      content: content.trim(),
      reply_to_id: replyTo?.id ?? null,
    }).select().single();

    if (error || !msgData) {
      toast.error('Failed to send: ' + (error?.message ?? 'Unknown error'));
      return;
    }

    setReplyTo(null);

    // Upload files if any
    if (files.length > 0) {
      setUploading(true);
      for (const pf of files) {
        const ext = pf.file.name.split('.').pop() ?? 'bin';
        const storagePath = `${room.id}/${msgData.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from('chat-attachments')
          .upload(storagePath, pf.file, { contentType: pf.file.type });

        if (uploadErr) {
          toast.error(`Failed to upload ${pf.file.name}: ${uploadErr.message}`);
          continue;
        }

        // Save attachment record
        await supabase.from('message_attachments').insert({
          message_id: msgData.id,
          file_name: pf.file.name,
          file_url: storagePath,
          file_size: pf.file.size,
          content_type: pf.file.type || 'application/octet-stream',
        });
      }
      setUploading(false);
      // Reload attachments for this message
      loadAttachmentsForMessages([msgData.id]);
    }
  };

  const handleEdit = async (messageId: string, content: string) => {
    const { error } = await supabase.from('messages').update({ content, is_edited: true }).eq('id', messageId);
    if (error) toast.error('Failed to edit');
  };

  const handleDelete = async (messageId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) toast.error('Failed to delete');
  };

  const handleBanUser = async (userId: string, username: string) => {
    if (!user) return;
    const confirmed = window.confirm(`Ban "${username}" from this room? They will be removed immediately.`);
    if (!confirmed) return;
    const { error } = await supabase.from('room_bans').insert({
      room_id: room.id,
      user_id: userId,
      banned_by: user.id,
    });
    if (error) {
      toast.error('Failed to ban user: ' + error.message);
    } else {
      toast.success(`${username} has been banned from this room`);
    }
  };

  const isOwner = room.owner_id === user?.id;
  const isAdmin = myRole === 'admin' || myRole === 'owner';

  const handleStartCall = async (type: CallType) => {
    if (!user) return;
    const { data: members } = await supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', room.id)
      .neq('user_id', user.id)
      .limit(1);

    if (!members || members.length === 0) {
      toast.error('No other members in this room to call');
      return;
    }

    const targetId = members[0].user_id;
    const targetProfile = profiles[targetId];
    const targetName = targetProfile?.username || 'User';
    onStartCall(targetId, targetName, room.id, type);
  };

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
        <div className="flex items-center gap-1">
          <CallButton
            onVoiceCall={() => handleStartCall('voice')}
            onVideoCall={() => handleStartCall('video')}
          />
          {isAdmin && !room.is_personal && (
            <Button variant="ghost" size="sm" onClick={() => setShowAdmin(true)} className="h-7 text-xs text-muted-foreground gap-1" title="Room settings">
              <Settings2 className="h-3 w-3" />
              <span className="hidden sm:inline">Manage</span>
            </Button>
          )}
          {!isOwner && !room.is_personal && (
            <Button variant="ghost" size="sm" onClick={() => onLeaveRoom(room.id)} className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1">
              <LogOut className="h-3 w-3" />
              Leave
            </Button>
          )}
        </div>
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
              attachments={attachments[msg.id]}
              onReply={() => setReplyTo(msg)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onBanUser={handleBanUser}
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
        uploading={uploading}
      />

      {isAdmin && !room.is_personal && user && (
        <RoomAdminDialog
          open={showAdmin}
          onOpenChange={setShowAdmin}
          room={room}
          currentUserId={user.id}
          isOwner={isOwner}
          isAdmin={isAdmin}
          onRoomDeleted={onRoomsChanged}
        />
      )}
    </div>
  );
}
