import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';
import { useWebRTC } from '@/hooks/useWebRTC';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Sidebar } from './Sidebar';
import { ChatWindow } from './ChatWindow';
import { RoomMembers } from './RoomMembers';
import { TopBar } from './TopBar';
import { RoomCatalog } from './RoomCatalog';
import { CallModal } from './CallModal';
import { IncomingCall } from './IncomingCall';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Room = Tables<'rooms'>;

export function ChatLayout() {
  usePresence();
  const { user, profile } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const activeRoom = rooms.find(r => r.id === activeRoomId) ?? null;

  useEffect(() => {
    if (!user) return;
    loadRooms();
  }, [user]);

  const loadRooms = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('room_members')
        .select('room_id, rooms(*)')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading rooms:', error);
        return;
      }

      if (data) {
        const roomList = data
          .map(d => d.rooms)
          .filter(Boolean) as Room[];
        setRooms(roomList);
      }
    } catch (e) {
      console.error('Failed to load rooms:', e);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('room_members').insert({
        room_id: roomId,
        user_id: user.id,
      });
      if (error) {
        toast.error('Failed to join room: ' + error.message);
        return;
      }
      toast.success('Joined room!');
      await loadRooms();
      setActiveRoomId(roomId);
      setShowCatalog(false);
    } catch (e: any) {
      toast.error('Failed to join room');
    }
  };

  const handleCreateRoom = async (name: string, description: string, visibility: 'public' | 'private') => {
    if (!user) return;
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .insert({
          name,
          description: description || null,
          visibility,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Create room error:', error);
        throw new Error(error.message);
      }

      if (room) {
        const { error: memberError } = await supabase
          .from('room_members')
          .insert({
            room_id: room.id,
            user_id: user.id,
            role: 'owner' as const,
          });

        if (memberError) {
          console.error('Add member error:', memberError);
        }

        await loadRooms();
        setActiveRoomId(room.id);
        setShowCatalog(false);
      }
    } catch (e: any) {
      throw e;
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id);
    if (error) {
      toast.error('Failed to leave room');
      return;
    }
    toast.success('Left room');
    if (activeRoomId === roomId) setActiveRoomId(null);
    await loadRooms();
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar
        profile={profile}
        onShowCatalog={() => setShowCatalog(true)}
        activeRoom={activeRoom}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={(id) => { setActiveRoomId(id); setShowCatalog(false); }}
          onShowCatalog={() => setShowCatalog(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex flex-1 flex-col overflow-hidden bg-chat-bg">
          {showCatalog ? (
            <RoomCatalog
              onJoinRoom={handleJoinRoom}
              onCreateRoom={handleCreateRoom}
              onClose={() => setShowCatalog(false)}
              userRoomIds={rooms.map(r => r.id)}
            />
          ) : activeRoom ? (
            <ChatWindow room={activeRoom} onLeaveRoom={handleLeaveRoom} onRoomsChanged={loadRooms} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">Welcome to ChatRoom</p>
                <p className="mt-1 text-sm">Select a channel or browse rooms to get started</p>
              </div>
              <Button
                onClick={() => setShowCatalog(true)}
                className="mt-2 rounded-xl px-6"
              >
                Browse Rooms
              </Button>
            </div>
          )}
        </main>
        {activeRoom && !showCatalog && (
          <RoomMembers roomId={activeRoom.id} />
        )}
      </div>
    </div>
  );
}
