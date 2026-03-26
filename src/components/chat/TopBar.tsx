import { useAuth } from '@/hooks/useAuth';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { LogOut, Search, MessageSquare, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

type Profile = Tables<'profiles'>;
type Room = Tables<'rooms'>;

interface TopBarProps {
  profile: Profile | null;
  onShowCatalog: () => void;
  activeRoom: Room | null;
}

export function TopBar({ profile, onShowCatalog, activeRoom }: TopBarProps) {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out');
    } catch (err: any) {
      toast.error('Failed to sign out');
      console.error('Sign out error:', err);
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <MessageSquare className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-foreground">Chat Room</span>
          {activeRoom && (
            <>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-mono text-sm font-medium text-foreground">
                # {activeRoom.name}
              </span>
              {activeRoom.description && (
                <span className="hidden text-xs text-muted-foreground md:inline">
                  — {activeRoom.description}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onShowCatalog} className="rounded-lg">
          <Search className="mr-1.5 h-3.5 w-3.5" />
          Browse Rooms
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 rounded-lg font-mono">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {(profile?.username?.[0] ?? 'U').toUpperCase()}
              </div>
              <span className="hidden sm:inline">{profile?.username ?? 'User'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {profile?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
