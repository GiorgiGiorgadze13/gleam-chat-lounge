import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { Hash, Lock, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Room = Tables<'rooms'>;

interface SidebarProps {
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
  onShowCatalog: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ rooms, activeRoomId, onSelectRoom, onShowCatalog, collapsed, onToggleCollapse }: SidebarProps) {
  const publicRooms = rooms.filter(r => !r.is_personal && r.visibility === 'public');
  const privateRooms = rooms.filter(r => !r.is_personal && r.visibility === 'private');
  const personalRooms = rooms.filter(r => r.is_personal);

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200 scrollbar-thin overflow-y-auto',
        collapsed ? 'w-12' : 'w-60'
      )}
    >
      <div className="flex items-center justify-between p-2">
        {!collapsed && <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Rooms</span>}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!collapsed && (
        <>
          {publicRooms.length > 0 && (
            <RoomSection title="Public" rooms={publicRooms} activeRoomId={activeRoomId} onSelectRoom={onSelectRoom} icon="hash" />
          )}
          {privateRooms.length > 0 && (
            <RoomSection title="Private" rooms={privateRooms} activeRoomId={activeRoomId} onSelectRoom={onSelectRoom} icon="lock" />
          )}
          {personalRooms.length > 0 && (
            <RoomSection title="Direct Messages" rooms={personalRooms} activeRoomId={activeRoomId} onSelectRoom={onSelectRoom} icon="hash" />
          )}

          <div className="mt-auto p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={onShowCatalog}
            >
              <Plus className="mr-2 h-4 w-4" />
              Join or Create Room
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}

function RoomSection({ title, rooms, activeRoomId, onSelectRoom, icon }: {
  title: string;
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
  icon: 'hash' | 'lock';
}) {
  const Icon = icon === 'hash' ? Hash : Lock;

  return (
    <div className="px-2 py-1">
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
        {title}
      </p>
      {rooms.map(room => (
        <button
          key={room.id}
          onClick={() => onSelectRoom(room.id)}
          className={cn(
            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors',
            activeRoomId === room.id
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{room.name}</span>
        </button>
      ))}
    </div>
  );
}
