import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Sidebar } from './Sidebar';
import { ChatWindow } from './ChatWindow';
import { RoomMembers } from './RoomMembers';
import { TopBar } from './TopBar';
import { RoomCatalog } from './RoomCatalog';
import { toast } from 'sonner';

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
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!user) return;
    const { error } = await supabase.from('room_members').insert({ room_id: roomId, user_id: user.id });
    if (error) {
      console.error('Join room error:', error);
      toast.error('Failed to join room: ' + error.message);
      return;
    }
    toast.success('Joined room!');
    await loadRooms();
    setActiveRoomId(roomId);
    setShowCatalog(false);
  };

  const handleCreateRoom = async (name: string, description: string, visibility: 'public' | 'private') => {
    if (!user) return;
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ name, description: description || null, visibility, owner_id: user.id })
      .select()
      .single();

    if (error) {
      console.error('Create room error:', error);
      throw new Error(error.message);
    }
    if (room) {
      const { error: memberError } = await supabase
        .from('room_members')
        .insert({ room_id: room.id, user_id: user.id, role: 'owner' as const });
      if (memberError) {
        console.error('Add member error:', memberError);
      }
      await loadRooms();
      setActiveRoomId(room.id);
      setShowCatalog(false);
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
                <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">Welcome to Chat Room</p>
                <p className="mt-1 text-sm">Select a channel or browse rooms to get started</p>
              </div>
              <button
                onClick={() => setShowCatalog(true)}
                className="mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg"
              >
                Browse Rooms
              </button>
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
