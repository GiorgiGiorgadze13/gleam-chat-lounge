import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { X, UserPlus, Check, XIcon, UserMinus, Search, Users, Inbox } from 'lucide-react';
import { PresenceDot } from './PresenceDot';
import { cn } from '@/lib/utils';

type Profile = Tables<'profiles'>;
type FriendRequest = Tables<'friend_requests'>;

interface FriendWithProfile {
  id: string;
  friendId: string;
  profile?: Profile;
  presence?: 'online' | 'afk' | 'offline';
}

interface FriendsPanelProps {
  onClose: () => void;
}

export function FriendsPanel({ onClose }: FriendsPanelProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<(FriendRequest & { profile?: Profile })[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<(FriendRequest & { profile?: Profile })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadFriends();
      loadRequests();
    }
  }, [user]);

  const loadFriends = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (!data || data.length === 0) { setFriends([]); return; }

    const friendUserIds = data.map(f => f.user_id === user.id ? f.friend_id : f.user_id);
    const [{ data: profiles }, { data: presences }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', friendUserIds),
      supabase.from('user_presence').select('*').in('user_id', friendUserIds),
    ]);

    const profileMap = new Map(profiles?.map(p => [p.id, p]));
    const presenceMap = new Map(presences?.map(p => [p.user_id, p.status as 'online' | 'afk' | 'offline']));

    setFriends(data.map(f => {
      const fId = f.user_id === user.id ? f.friend_id : f.user_id;
      return { id: f.id, friendId: fId, profile: profileMap.get(fId), presence: presenceMap.get(fId) ?? 'offline' };
    }));
  };

  const loadRequests = async () => {
    if (!user) return;

    const { data: incoming } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('to_user_id', user.id)
      .eq('status', 'pending');

    const { data: outgoing } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('from_user_id', user.id)
      .eq('status', 'pending');

    const allUserIds = [
      ...(incoming?.map(r => r.from_user_id) ?? []),
      ...(outgoing?.map(r => r.to_user_id) ?? []),
    ];

    let profileMap = new Map<string, Profile>();
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', allUserIds);
      profileMap = new Map(profiles?.map(p => [p.id, p]));
    }

    setIncomingRequests((incoming ?? []).map(r => ({ ...r, profile: profileMap.get(r.from_user_id) })));
    setOutgoingRequests((outgoing ?? []).map(r => ({ ...r, profile: profileMap.get(r.to_user_id) })));
  };

  const handleSearch = async () => {
    if (!user || searchQuery.trim().length < 2) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery.trim()}%`)
      .neq('id', user.id)
      .limit(10);
    setSearchResults(data ?? []);
    setSearching(false);
  };

  const handleSendRequest = async (toUserId: string) => {
    if (!user) return;
    setSendingTo(toUserId);
    const { error } = await supabase.from('friend_requests').insert({
      from_user_id: user.id,
      to_user_id: toUserId,
    });
    setSendingTo(null);
    if (error) {
      if (error.message.includes('duplicate')) toast.error('Request already sent');
      else toast.error(error.message);
    } else {
      toast.success('Friend request sent!');
      loadRequests();
    }
  };

  const handleAccept = async (requestId: string, fromUserId: string) => {
    if (!user) return;
    // Update request status
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId);
    // Create friendship (both directions)
    await supabase.from('friends').insert([
      { user_id: user.id, friend_id: fromUserId },
    ]);
    toast.success('Friend added!');
    loadFriends();
    loadRequests();
  };

  const handleReject = async (requestId: string) => {
    await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', requestId);
    toast.success('Request rejected');
    loadRequests();
  };

  const handleRemoveFriend = async (friendRecordId: string) => {
    const { error } = await supabase.from('friends').delete().eq('id', friendRecordId);
    if (error) toast.error('Failed to remove friend');
    else { toast.success('Friend removed'); loadFriends(); }
  };

  const pendingCount = incomingRequests.length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b bg-card px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">Friends</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-card px-2">
        {(['friends', 'requests', 'add'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'relative px-3 py-2 text-xs font-medium transition-colors',
              tab === t ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'friends' ? 'All Friends' : t === 'requests' ? 'Requests' : 'Add Friend'}
            {t === 'requests' && pendingCount > 0 && (
              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {pendingCount}
              </span>
            )}
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'friends' && (
          <div className="space-y-1">
            {friends.length === 0 ? (
              <div className="py-8 text-center">
                <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No friends yet</p>
                <p className="text-xs text-muted-foreground/60">Search for users to add them</p>
              </div>
            ) : friends.map(f => (
              <div key={f.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-muted/50">
                <div className="relative">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                    f.presence === 'offline' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                  )}>
                    {(f.profile?.username?.[0] ?? '?').toUpperCase()}
                  </div>
                  <PresenceDot status={f.presence ?? 'offline'} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background" />
                </div>
                <span className="flex-1 text-sm font-medium">{f.profile?.username ?? 'Unknown'}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveFriend(f.id)}>
                  <UserMinus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {tab === 'requests' && (
          <div className="space-y-4">
            {incomingRequests.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Incoming</p>
                <div className="space-y-1">
                  {incomingRequests.map(r => (
                    <div key={r.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-muted/30">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(r.profile?.username?.[0] ?? '?').toUpperCase()}
                      </div>
                      <span className="flex-1 text-sm font-medium">{r.profile?.username ?? 'Unknown'}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={() => handleAccept(r.id, r.from_user_id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleReject(r.id)}>
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {outgoingRequests.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Sent</p>
                <div className="space-y-1">
                  {outgoingRequests.map(r => (
                    <div key={r.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                        {(r.profile?.username?.[0] ?? '?').toUpperCase()}
                      </div>
                      <span className="flex-1 text-sm font-medium text-muted-foreground">{r.profile?.username ?? 'Unknown'}</span>
                      <span className="text-[10px] text-muted-foreground/60">Pending</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <div className="py-8 text-center">
                <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No pending requests</p>
              </div>
            )}
          </div>
        )}

        {tab === 'add' && (
          <div className="space-y-4">
            <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username..."
                className="h-9 rounded-xl bg-muted/50 border-0 text-sm flex-1"
              />
              <Button type="submit" size="sm" className="rounded-xl h-9" disabled={searching || searchQuery.trim().length < 2}>
                <Search className="h-3.5 w-3.5" />
              </Button>
            </form>
            <div className="space-y-1">
              {searchResults.map(p => {
                const alreadyFriend = friends.some(f => f.friendId === p.id);
                const alreadySent = outgoingRequests.some(r => r.to_user_id === p.id);
                return (
                  <div key={p.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {(p.username?.[0] ?? '?').toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm font-medium">{p.username}</span>
                    {alreadyFriend ? (
                      <span className="text-[10px] text-muted-foreground">Already friends</span>
                    ) : alreadySent ? (
                      <span className="text-[10px] text-muted-foreground">Request sent</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleSendRequest(p.id)}
                        disabled={sendingTo === p.id}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
