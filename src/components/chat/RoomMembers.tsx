import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { PresenceDot } from './PresenceDot';
import { cn } from '@/lib/utils';

type Profile = Tables<'profiles'>;
type RoomMember = Tables<'room_members'>;

interface MemberWithProfile extends RoomMember {
  profile?: Profile;
  presence?: 'online' | 'afk' | 'offline';
}

interface RoomMembersProps {
  roomId: string;
}

export function RoomMembers({ roomId }: RoomMembersProps) {
  const [members, setMembers] = useState<MemberWithProfile[]>([]);

  useEffect(() => {
    loadMembers();

    const channel = supabase
      .channel(`members-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_members',
        filter: `room_id=eq.${roomId}`,
      }, () => loadMembers())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_presence',
      }, () => loadMembers())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const loadMembers = async () => {
    const { data: memberData } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', roomId);

    if (!memberData || memberData.length === 0) {
      setMembers([]);
      return;
    }

    const userIds = memberData.map(m => m.user_id);
    const [{ data: profileData }, { data: presenceData }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', userIds),
      supabase.from('user_presence').select('*').in('user_id', userIds),
    ]);

    const profileMap = new Map(profileData?.map(p => [p.id, p]));
    const presenceMap = new Map(presenceData?.map(p => [p.user_id, p.status as 'online' | 'afk' | 'offline']));

    const enriched: MemberWithProfile[] = memberData.map(m => ({
      ...m,
      profile: profileMap.get(m.user_id),
      presence: presenceMap.get(m.user_id) ?? 'offline',
    }));

    const order = { online: 0, afk: 1, offline: 2 };
    enriched.sort((a, b) => (order[a.presence ?? 'offline'] - order[b.presence ?? 'offline']));

    setMembers(enriched);
  };

  const onlineCount = members.filter(m => m.presence === 'online').length;

  return (
    <aside className="hidden w-52 border-l bg-card overflow-y-auto scrollbar-thin lg:block">
      <div className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Members — {members.length}
        </h4>
        <p className="text-[10px] text-muted-foreground/60">{onlineCount} online</p>

        <div className="mt-3 space-y-0.5">
          {members.map(m => {
            const initial = (m.profile?.username?.[0] ?? '?').toUpperCase();
            return (
              <div key={m.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50">
                <div className="relative">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold',
                    m.presence === 'offline'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-primary/10 text-primary'
                  )}>
                    {initial}
                  </div>
                  <PresenceDot status={m.presence ?? 'offline'} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className={cn(
                    'block truncate text-xs font-medium',
                    m.presence === 'offline' ? 'text-muted-foreground' : 'text-foreground'
                  )}>
                    {m.profile?.username ?? 'Unknown'}
                  </span>
                  {m.role !== 'member' && (
                    <span className="text-[9px] font-bold uppercase text-primary/60">
                      {m.role}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
