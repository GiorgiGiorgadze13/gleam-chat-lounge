import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { Hash, Lock, Plus, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
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
        collapsed ? 'w-14' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sidebar-border p-3">
        {!collapsed && (
          <span className="text-xs font-bold uppercase tracking-widest text-sidebar-foreground/40">
            Channels
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!collapsed ? (
        <div className="flex-1 overflow-y-auto py-2">
          {publicRooms.length > 0 && (
            <RoomSection title="Public Rooms" rooms={publicRooms} activeRoomId={activeRoomId} onSelectRoom={onSelectRoom} icon="hash" />
          )}
          {privateRooms.length > 0 && (
            <RoomSection title="Private Rooms" rooms={privateRooms} activeRoomId={activeRoomId} onSelectRoom={onSelectRoom} icon="lock" />
          )}
          {personalRooms.length > 0 && (
            <RoomSection title="Direct Messages" rooms={personalRooms} activeRoomId={activeRoomId} onSelectRoom={onSelectRoom} icon="dm" />
          )}
          {rooms.length === 0 && (
            <div className="px-4 py-8 text-center">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 text-sidebar-foreground/20" />
              <p className="text-xs text-sidebar-foreground/40">No rooms yet</p>
              <p className="text-[10px] text-sidebar-foreground/30">Browse or create one</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Bottom action */}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className={cn(
            'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent',
            !collapsed && 'w-full justify-start'
          )}
          onClick={onShowCatalog}
        >
          <Plus className={cn('h-4 w-4', !collapsed && 'mr-2')} />
          {!collapsed && 'Join or Create Room'}
        </Button>
      </div>
    </aside>
  );
}

function RoomSection({ title, rooms, activeRoomId, onSelectRoom, icon }: {
  title: string;
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
  icon: 'hash' | 'lock' | 'dm';
}) {
  const Icon = icon === 'hash' ? Hash : icon === 'lock' ? Lock : MessageCircle;

  return (
    <div className="px-2 py-1">
      <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/30">
        {title}
      </p>
      {rooms.map(room => (
        <button
          key={room.id}
          onClick={() => onSelectRoom(room.id)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all',
            activeRoomId === room.id
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
              : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate font-medium">{room.name}</span>
        </button>
      ))}
    </div>
  );
}
