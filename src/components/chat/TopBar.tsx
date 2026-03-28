import { useAuth } from '@/hooks/useAuth';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { LogOut, Search, MessageCircle, Users, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type Profile = Tables<'profiles'>;
type Room = Tables<'rooms'>;

interface TopBarProps {
  profile: Profile | null;
  onShowCatalog: () => void;
  activeRoom: Room | null;
  onShowFriends: () => void;
  onShowSettings: () => void;
}

export function TopBar({ profile, onShowCatalog, activeRoom, onShowFriends, onShowSettings }: TopBarProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out');
      navigate('/auth', { replace: true });
    } catch (err: any) {
      toast.error('Failed to sign out');
      console.error('Sign out error:', err);
    }
  };

  return (
    <header className="flex h-12 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <MessageCircle className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-sm font-bold text-foreground">ChatRoom</span>
        {activeRoom && (
          <>
            <span className="text-muted-foreground/30 text-xs">/</span>
            <span className="text-xs font-medium text-foreground font-mono">
              #{activeRoom.name}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onShowCatalog} className="h-8 gap-1.5 rounded-lg text-xs">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Browse</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onShowFriends} className="h-8 gap-1.5 rounded-lg text-xs">
          <Users className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Friends</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onShowSettings} className="h-8 gap-1.5 rounded-lg text-xs">
          <Settings className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {(profile?.username?.[0] ?? 'U').toUpperCase()}
              </div>
              <span className="hidden sm:inline text-xs font-medium">{profile?.username ?? 'User'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {profile?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
