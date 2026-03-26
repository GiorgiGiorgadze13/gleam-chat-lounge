import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Users, X, Hash } from 'lucide-react';
import { toast } from 'sonner';

type Room = Tables<'rooms'>;

interface RoomCatalogProps {
  onJoinRoom: (roomId: string) => void;
  onCreateRoom: (name: string, description: string, visibility: 'public' | 'private') => Promise<void>;
  onClose: () => void;
  userRoomIds: string[];
}

export function RoomCatalog({ onJoinRoom, onCreateRoom, onClose, userRoomIds }: RoomCatalogProps) {
  const [rooms, setRooms] = useState<(Room & { member_count: number })[]>([]);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVis, setNewVis] = useState<'public' | 'private'>('public');
  const [creating, setCreating] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    loadPublicRooms();
  }, [search]);

  const loadPublicRooms = async () => {
    setLoadingRooms(true);
    try {
      let query = supabase
        .from('rooms')
        .select('*')
        .eq('visibility', 'public')
        .eq('is_personal', false)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error loading rooms:', error);
        setLoadingRooms(false);
        return;
      }
      if (data) {
        const roomsWithCounts = await Promise.all(
          data.map(async (room) => {
            const { count } = await supabase
              .from('room_members')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', room.id);
            return { ...room, member_count: count ?? 0 };
          })
        );
        setRooms(roomsWithCounts);
      }
    } catch (e) {
      console.error('Failed to load rooms:', e);
    }
    setLoadingRooms(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Room name is required');
      return;
    }
    setCreating(true);
    try {
      await onCreateRoom(newName.trim(), newDesc.trim(), newVis);
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      setNewVis('public');
      toast.success('Room created!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create room');
    }
    setCreating(false);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b bg-card px-5 py-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Browse Rooms</h2>
          <p className="text-[11px] text-muted-foreground">Find and join public rooms</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1 rounded-lg text-xs">
                <Plus className="h-3.5 w-3.5" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Room Name</Label>
                  <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="general"
                    className="font-mono"
                    maxLength={50}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What's this room about?" maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Visibility</Label>
                  <Select value={newVis} onValueChange={(v) => setNewVis(v as 'public' | 'private')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public — anyone can join</SelectItem>
                      <SelectItem value="private">Private — invite only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="w-full rounded-lg">
                  {creating ? 'Creating...' : 'Create Room'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-5 py-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rooms..."
            className="h-9 rounded-xl pl-9 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 scrollbar-thin">
        <div className="grid gap-1.5">
          {rooms.map(room => {
            const isMember = userRoomIds.includes(room.id);
            return (
              <div
                key={room.id}
                className="flex items-center justify-between rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Hash className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{room.name}</h3>
                    {room.description && (
                      <p className="truncate text-[11px] text-muted-foreground">{room.description}</p>
                    )}
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {room.member_count} {room.member_count === 1 ? 'member' : 'members'}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isMember ? 'secondary' : 'default'}
                  onClick={() => !isMember && onJoinRoom(room.id)}
                  disabled={isMember}
                  className="h-8 rounded-lg text-xs"
                >
                  {isMember ? 'Joined' : 'Join'}
                </Button>
              </div>
            );
          })}
          {!loadingRooms && rooms.length === 0 && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Hash className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {search ? 'No rooms match your search' : 'No public rooms yet'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {search ? 'Try a different search' : 'Create the first one!'}
              </p>
            </div>
          )}
          {loadingRooms && (
            <p className="py-8 text-center text-xs text-muted-foreground">Loading...</p>
          )}
        </div>
      </div>
    </div>
  );
}
