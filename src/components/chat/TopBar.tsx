import { useAuth } from '@/hooks/useAuth';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { LogOut, Search, MessageSquare, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type Profile = Tables<'profiles'>;
type Room = Tables<'rooms'>;

interface TopBarProps {
  profile: Profile | null;
  onShowCatalog: () => void;
  activeRoom: Room | null;
}

export function TopBar({ profile, onShowCatalog, activeRoom }: TopBarProps) {
  const { signOut } = useAuth();

  return (
    <header className="flex h-12 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">WebChat</span>
        {activeRoom && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="font-mono text-sm text-foreground">{activeRoom.name}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onShowCatalog}>
          <Search className="mr-1 h-4 w-4" />
          Browse Rooms
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="font-mono">
              {profile?.username ?? 'User'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {profile?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
