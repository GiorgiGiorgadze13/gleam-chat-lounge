import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Users, X } from 'lucide-react';
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

  useEffect(() => {
    loadPublicRooms();
  }, [search]);

  const loadPublicRooms = async () => {
    let query = supabase
      .from('rooms')
      .select('*')
      .eq('visibility', 'public')
      .eq('is_personal', false)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data } = await query;
    if (data) {
      // Get member counts
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
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreateRoom(newName.trim(), newDesc.trim(), newVis);
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      toast.success('Room created!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create room');
    }
    setCreating(false);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b bg-card p-4">
        <h2 className="text-lg font-semibold">Room Catalog</h2>
        <div className="flex items-center gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Create Room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Chat Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Room Name</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="general" className="font-mono" maxLength={50} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What's this room about?" maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select value={newVis} onValueChange={(v) => setNewVis(v as 'public' | 'private')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full">
                  {creating ? 'Creating...' : 'Create Room'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rooms..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
        <div className="grid gap-3">
          {rooms.map(room => {
            const isMember = userRoomIds.includes(room.id);
            return (
              <Card key={room.id} className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-mono font-medium">{room.name}</h3>
                    {room.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground truncate">{room.description}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{room.member_count} members</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isMember ? 'secondary' : 'default'}
                    onClick={() => !isMember && onJoinRoom(room.id)}
                    disabled={isMember}
                  >
                    {isMember ? 'Joined' : 'Join'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {rooms.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search ? 'No rooms match your search' : 'No public rooms yet. Create one!'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
