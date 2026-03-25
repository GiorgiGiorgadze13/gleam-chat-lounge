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
    const { data } = await supabase
      .from('room_members')
      .select('room_id, rooms(*)')
      .eq('user_id', user.id);

    if (data) {
      const roomList = data
        .map(d => d.rooms)
        .filter(Boolean) as Room[];
      setRooms(roomList);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!user) return;
    await supabase.from('room_members').insert({ room_id: roomId, user_id: user.id });
    await loadRooms();
    setActiveRoomId(roomId);
    setShowCatalog(false);
  };

  const handleCreateRoom = async (name: string, description: string, visibility: 'public' | 'private') => {
    if (!user) return;
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ name, description, visibility, owner_id: user.id })
      .select()
      .single();

    if (error) throw error;
    if (room) {
      await supabase.from('room_members').insert({ room_id: room.id, user_id: user.id, role: 'owner' });
      await loadRooms();
      setActiveRoomId(room.id);
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    if (!user) return;
    await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', user.id);
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
        <main className="flex flex-1 flex-col overflow-hidden">
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
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">Welcome to WebChat</p>
                <p className="mt-1 text-sm">Select a room or browse the catalog to get started</p>
              </div>
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
