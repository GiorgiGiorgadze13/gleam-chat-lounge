import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PresenceDot } from './PresenceDot';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Shield, ShieldOff, UserMinus, Ban, Undo2, Trash2, Users, ShieldAlert, UserX } from 'lucide-react';

type Room = Tables<'rooms'>;
type Profile = Tables<'profiles'>;

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  profile?: Profile;
  presence?: 'online' | 'afk' | 'offline';
}

interface BanRow {
  id: string;
  user_id: string;
  banned_by: string;
  created_at: string;
  profile?: Profile;
  bannedByProfile?: Profile;
}

interface RoomAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  currentUserId: string;
  isOwner: boolean;
  isAdmin: boolean;
  onRoomDeleted: () => void;
}

export function RoomAdminDialog({ open, onOpenChange, room, currentUserId, isOwner, isAdmin, onRoomDeleted }: RoomAdminDialogProps) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Confirmation dialogs
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
    destructive?: boolean;
  } | null>(null);

  const loadMembers = useCallback(async () => {
    const { data: memberData } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', room.id);

    if (!memberData) return;

    const userIds = memberData.map(m => m.user_id);
    const [{ data: profileData }, { data: presenceData }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', userIds),
      supabase.from('user_presence').select('*').in('user_id', userIds),
    ]);

    const profileMap = new Map(profileData?.map(p => [p.id, p]));
    const presenceMap = new Map(presenceData?.map(p => [p.user_id, p.status as 'online' | 'afk' | 'offline']));

    setMembers(memberData.map(m => ({
      ...m,
      profile: profileMap.get(m.user_id),
      presence: presenceMap.get(m.user_id) ?? 'offline',
    })));
  }, [room.id]);

  const loadBans = useCallback(async () => {
    const { data: banData } = await supabase
      .from('room_bans')
      .select('*')
      .eq('room_id', room.id);

    if (!banData) return;

    const allUserIds = [...new Set([...banData.map(b => b.user_id), ...banData.map(b => b.banned_by)])];
    const { data: profileData } = await supabase.from('profiles').select('*').in('id', allUserIds);
    const profileMap = new Map(profileData?.map(p => [p.id, p]));

    setBans(banData.map(b => ({
      ...b,
      profile: profileMap.get(b.user_id),
      bannedByProfile: profileMap.get(b.banned_by),
    })));
  }, [room.id]);

  useEffect(() => {
    if (open) {
      loadMembers();
      loadBans();
    }
  }, [open, loadMembers, loadBans]);

  const handleRemoveMember = (member: MemberRow) => {
    setConfirmAction({
      title: 'Remove Member',
      description: `Remove "${member.profile?.username ?? 'Unknown'}" from this room? They can rejoin if the room is public.`,
      action: async () => {
        const { error } = await supabase.from('room_members').delete().eq('id', member.id);
        if (error) toast.error('Failed to remove member');
        else { toast.success(`${member.profile?.username} removed`); loadMembers(); }
      },
    });
  };

  const handleBanMember = (member: MemberRow) => {
    setConfirmAction({
      title: 'Ban User',
      description: `Ban "${member.profile?.username ?? 'Unknown'}" from this room? They will be removed and unable to rejoin.`,
      destructive: true,
      action: async () => {
        const { error } = await supabase.from('room_bans').insert({
          room_id: room.id,
          user_id: member.user_id,
          banned_by: currentUserId,
        });
        if (error) toast.error('Failed to ban: ' + error.message);
        else { toast.success(`${member.profile?.username} banned`); loadMembers(); loadBans(); }
      },
    });
  };

  const handleUnban = (ban: BanRow) => {
    setConfirmAction({
      title: 'Unban User',
      description: `Unban "${ban.profile?.username ?? 'Unknown'}"? They will be able to rejoin the room.`,
      action: async () => {
        const { error } = await supabase.from('room_bans').delete().eq('id', ban.id);
        if (error) toast.error('Failed to unban');
        else { toast.success(`${ban.profile?.username} unbanned`); loadBans(); }
      },
    });
  };

  const handlePromoteAdmin = (member: MemberRow) => {
    setConfirmAction({
      title: 'Promote to Admin',
      description: `Make "${member.profile?.username ?? 'Unknown'}" an admin? They will be able to manage members, bans, and delete messages.`,
      action: async () => {
        const { error } = await supabase.from('room_members').update({ role: 'admin' }).eq('id', member.id);
        if (error) toast.error('Failed to promote');
        else { toast.success(`${member.profile?.username} is now admin`); loadMembers(); }
      },
    });
  };

  const handleDemoteAdmin = (member: MemberRow) => {
    setConfirmAction({
      title: 'Remove Admin',
      description: `Remove admin role from "${member.profile?.username ?? 'Unknown'}"?`,
      action: async () => {
        const { error } = await supabase.from('room_members').update({ role: 'member' }).eq('id', member.id);
        if (error) toast.error('Failed to demote');
        else { toast.success(`${member.profile?.username} is now a regular member`); loadMembers(); }
      },
    });
  };

  const handleDeleteRoom = () => {
    setConfirmAction({
      title: 'Delete Room',
      description: `Permanently delete "${room.name}"? All messages, files, and attachments will be lost forever. This cannot be undone.`,
      destructive: true,
      action: async () => {
        setLoading(true);
        // Delete messages & attachments first (cascade should handle, but be safe)
        await supabase.from('messages').delete().eq('room_id', room.id);
        await supabase.from('room_members').delete().eq('room_id', room.id);
        await supabase.from('room_bans').delete().eq('room_id', room.id);
        await supabase.from('room_invitations').delete().eq('room_id', room.id);
        await supabase.from('unread_messages').delete().eq('room_id', room.id);
        const { error } = await supabase.from('rooms').delete().eq('id', room.id);
        setLoading(false);
        if (error) toast.error('Failed to delete room: ' + error.message);
        else {
          toast.success('Room deleted');
          onOpenChange(false);
          onRoomDeleted();
        }
      },
    });
  };

  const AVATAR_COLORS = [
    'bg-violet-500', 'bg-emerald-500', 'bg-orange-500', 'bg-sky-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
  ];

  const roleOrder = { owner: 0, admin: 1, member: 2 };
  const sortedMembers = [...members].sort((a, b) => (roleOrder[a.role as keyof typeof roleOrder] ?? 2) - (roleOrder[b.role as keyof typeof roleOrder] ?? 2));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Room Administration
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="members" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="members" className="text-xs gap-1">
                <Users className="h-3 w-3" /> Members
              </TabsTrigger>
              <TabsTrigger value="bans" className="text-xs gap-1">
                <Ban className="h-3 w-3" /> Banned
              </TabsTrigger>
              <TabsTrigger value="danger" className="text-xs gap-1">
                <Trash2 className="h-3 w-3" /> Danger
              </TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="flex-1 overflow-y-auto mt-2 space-y-1 scrollbar-thin">
              {sortedMembers.map(m => {
                const initial = (m.profile?.username?.[0] ?? '?').toUpperCase();
                const colorIdx = (m.profile?.username?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length;
                const isSelf = m.user_id === currentUserId;
                const isTargetOwner = m.role === 'owner';
                const isTargetAdmin = m.role === 'admin';

                return (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                    <div className="relative">
                      <div className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white',
                        AVATAR_COLORS[colorIdx]
                      )}>
                        {initial}
                      </div>
                      <PresenceDot status={m.presence ?? 'offline'} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-foreground">{m.profile?.username ?? 'Unknown'}</span>
                        {isSelf && <span className="text-[9px] text-muted-foreground">(you)</span>}
                      </div>
                      {m.role !== 'member' && (
                        <span className={cn(
                          'text-[9px] font-bold uppercase',
                          m.role === 'owner' ? 'text-amber-500' : 'text-primary/60'
                        )}>
                          {m.role}
                        </span>
                      )}
                    </div>

                    {!isSelf && !isTargetOwner && isAdmin && (
                      <div className="flex items-center gap-0.5">
                        {isOwner && (
                          isTargetAdmin ? (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDemoteAdmin(m)} title="Remove admin">
                              <ShieldOff className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handlePromoteAdmin(m)} title="Make admin">
                              <Shield className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          )
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveMember(m)} title="Remove">
                          <UserMinus className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleBanMember(m)} title="Ban">
                          <UserX className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {members.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No members</p>
              )}
            </TabsContent>

            <TabsContent value="bans" className="flex-1 overflow-y-auto mt-2 space-y-1 scrollbar-thin">
              {bans.map(b => {
                const initial = (b.profile?.username?.[0] ?? '?').toUpperCase();
                const colorIdx = (b.profile?.username?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length;

                return (
                  <div key={b.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                    <div className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white opacity-50',
                      AVATAR_COLORS[colorIdx]
                    )}>
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-foreground">{b.profile?.username ?? 'Unknown'}</span>
                      <span className="text-[9px] text-muted-foreground">
                        Banned by {b.bannedByProfile?.username ?? 'unknown'}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => handleUnban(b)}>
                      <Undo2 className="h-3 w-3" /> Unban
                    </Button>
                  </div>
                );
              })}
              {bans.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No banned users</p>
              )}
            </TabsContent>

            <TabsContent value="danger" className="mt-2 space-y-4">
              {isOwner && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <h4 className="text-sm font-semibold text-destructive">Delete Room</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Permanently delete this room and all its messages, files, and data. This action cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={handleDeleteRoom}
                    disabled={loading}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete "{room.name}"
                  </Button>
                </div>
              )}
              {!isOwner && (
                <p className="py-6 text-center text-xs text-muted-foreground">Only the room owner can perform destructive actions.</p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={async () => {
                await confirmAction?.action();
                setConfirmAction(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}