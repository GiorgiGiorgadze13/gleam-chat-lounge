
-- Enums
CREATE TYPE public.room_visibility AS ENUM ('public', 'private');
CREATE TYPE public.room_member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.presence_status AS ENUM ('online', 'afk', 'offline');
CREATE TYPE public.friend_request_status AS ENUM ('pending', 'accepted', 'rejected');

-- All tables first (no policies)

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status presence_status NOT NULL DEFAULT 'offline',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  status friend_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);

CREATE TABLE public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

CREATE TABLE public.user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(banned_by, banned_user)
);

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  visibility room_visibility NOT NULL DEFAULT 'public',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_personal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role room_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE public.room_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.personal_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

CREATE TABLE public.unread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 0,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, room_id)
);

CREATE TABLE public.room_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, invited_user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invitations ENABLE ROW LEVEL SECURITY;

-- Now all policies (tables exist)

-- Profiles
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Presence
CREATE POLICY "Presence viewable by authenticated" ON public.user_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own presence" ON public.user_presence FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own presence" ON public.user_presence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Friend requests
CREATE POLICY "Users see own friend requests" ON public.friend_requests FOR SELECT TO authenticated USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users send friend requests" ON public.friend_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users update requests sent to them" ON public.friend_requests FOR UPDATE TO authenticated USING (auth.uid() = to_user_id);
CREATE POLICY "Users delete own requests" ON public.friend_requests FOR DELETE TO authenticated USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Friends
CREATE POLICY "Users see own friends" ON public.friends FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users insert friends" ON public.friends FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove friends" ON public.friends FOR DELETE TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- User bans
CREATE POLICY "Users see own bans" ON public.user_bans FOR SELECT TO authenticated USING (auth.uid() = banned_by);
CREATE POLICY "Users create bans" ON public.user_bans FOR INSERT TO authenticated WITH CHECK (auth.uid() = banned_by);
CREATE POLICY "Users remove bans" ON public.user_bans FOR DELETE TO authenticated USING (auth.uid() = banned_by);

-- Rooms
CREATE POLICY "Rooms viewable" ON public.rooms FOR SELECT TO authenticated USING (
  visibility = 'public' OR
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = rooms.id AND rm.user_id = auth.uid())
);
CREATE POLICY "Users create rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates room" ON public.rooms FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owner deletes room" ON public.rooms FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Room members
CREATE POLICY "Members viewable by room members" ON public.room_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.room_members rm2 WHERE rm2.room_id = room_members.room_id AND rm2.user_id = auth.uid())
);
CREATE POLICY "Users join rooms" ON public.room_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins or self remove members" ON public.room_members FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.room_members rm2 WHERE rm2.room_id = room_members.room_id AND rm2.user_id = auth.uid() AND rm2.role IN ('admin', 'owner'))
);
CREATE POLICY "Admins update member roles" ON public.room_members FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.room_members rm2 WHERE rm2.room_id = room_members.room_id AND rm2.user_id = auth.uid() AND rm2.role IN ('admin', 'owner'))
);

-- Room bans
CREATE POLICY "Room bans viewable" ON public.room_bans FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_bans.room_id AND rm.user_id = auth.uid() AND rm.role IN ('admin', 'owner'))
  OR auth.uid() = user_id
);
CREATE POLICY "Admins create room bans" ON public.room_bans FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_bans.room_id AND rm.user_id = auth.uid() AND rm.role IN ('admin', 'owner'))
);
CREATE POLICY "Admins remove room bans" ON public.room_bans FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_bans.room_id AND rm.user_id = auth.uid() AND rm.role IN ('admin', 'owner'))
);

-- Messages
CREATE POLICY "Messages viewable by room members" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = messages.room_id AND rm.user_id = auth.uid())
);
CREATE POLICY "Members send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = messages.room_id AND rm.user_id = auth.uid())
);
CREATE POLICY "Authors edit messages" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authors or admins delete messages" ON public.messages FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = messages.room_id AND rm.user_id = auth.uid() AND rm.role IN ('admin', 'owner'))
);

-- Attachments
CREATE POLICY "Attachments viewable" ON public.message_attachments FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.room_members rm ON rm.room_id = m.room_id AND rm.user_id = auth.uid()
    WHERE m.id = message_attachments.message_id
  )
);
CREATE POLICY "Members create attachments" ON public.message_attachments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_attachments.message_id AND m.user_id = auth.uid())
);

-- Personal chats
CREATE POLICY "Users see own personal chats" ON public.personal_chats FOR SELECT TO authenticated USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users create personal chats" ON public.personal_chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users update personal chats" ON public.personal_chats FOR UPDATE TO authenticated USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Unread
CREATE POLICY "Users see own unreads" ON public.unread_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage unreads" ON public.unread_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update unreads" ON public.unread_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Invitations
CREATE POLICY "Users see own invitations" ON public.room_invitations FOR SELECT TO authenticated USING (auth.uid() = invited_user_id OR auth.uid() = invited_by);
CREATE POLICY "Members invite" ON public.room_invitations FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = invited_by AND
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_invitations.room_id AND rm.user_id = auth.uid())
);
CREATE POLICY "Users delete invitations" ON public.room_invitations FOR DELETE TO authenticated USING (auth.uid() = invited_user_id OR auth.uid() = invited_by);

-- Indexes
CREATE INDEX idx_messages_room_created ON public.messages(room_id, created_at DESC);
CREATE INDEX idx_room_members_room ON public.room_members(room_id);
CREATE INDEX idx_room_members_user ON public.room_members(user_id);
CREATE INDEX idx_friends_user ON public.friends(user_id);
CREATE INDEX idx_friends_friend ON public.friends(friend_id);
CREATE INDEX idx_personal_chats_users ON public.personal_chats(user1_id, user2_id);
CREATE INDEX idx_unread_user_room ON public.unread_messages(user_id, room_id);

-- Triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email) VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.email);
  INSERT INTO public.user_presence (user_id, status) VALUES (NEW.id, 'offline');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('chat-attachments', 'chat-attachments', false, 20971520);

CREATE POLICY "Auth upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');
CREATE POLICY "Auth read attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-attachments');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
