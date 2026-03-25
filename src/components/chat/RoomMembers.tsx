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

    if (!memberData) return;

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

    // Sort: online first, then afk, then offline
    const order = { online: 0, afk: 1, offline: 2 };
    enriched.sort((a, b) => (order[a.presence ?? 'offline'] - order[b.presence ?? 'offline']));

    setMembers(enriched);
  };

  return (
    <aside className="w-48 border-l bg-card overflow-y-auto scrollbar-thin">
      <div className="p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Members — {members.length}
        </h4>
        <div className="mt-2 space-y-1">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-2 rounded px-2 py-1">
              <PresenceDot status={m.presence ?? 'offline'} />
              <span className={cn(
                'truncate font-mono text-xs',
                m.presence === 'offline' ? 'text-muted-foreground' : 'text-foreground'
              )}>
                {m.profile?.username ?? 'Unknown'}
              </span>
              {m.role !== 'member' && (
                <span className="ml-auto text-[9px] font-semibold uppercase text-accent">
                  {m.role}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
