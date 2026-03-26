
-- Create a security definer function to check room membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_room_member(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE user_id = _user_id AND room_id = _room_id
  )
$$;

-- Create a security definer function to check room admin/owner role
CREATE OR REPLACE FUNCTION public.is_room_admin(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE user_id = _user_id AND room_id = _room_id
    AND role IN ('admin', 'owner')
  )
$$;

-- Drop all existing policies on room_members
DROP POLICY IF EXISTS "Members viewable by room members" ON public.room_members;
DROP POLICY IF EXISTS "Users join rooms" ON public.room_members;
DROP POLICY IF EXISTS "Admins or self remove members" ON public.room_members;
DROP POLICY IF EXISTS "Admins update member roles" ON public.room_members;

-- Recreate without self-referencing subqueries
CREATE POLICY "Members viewable by room members" ON public.room_members
  FOR SELECT TO authenticated
  USING (public.is_room_member(auth.uid(), room_id));

CREATE POLICY "Users join rooms" ON public.room_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins or self remove members" ON public.room_members
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_room_admin(auth.uid(), room_id));

CREATE POLICY "Admins update member roles" ON public.room_members
  FOR UPDATE TO authenticated
  USING (public.is_room_admin(auth.uid(), room_id));

-- Fix rooms SELECT policy that references room_members
DROP POLICY IF EXISTS "Rooms viewable" ON public.rooms;
CREATE POLICY "Rooms viewable" ON public.rooms
  FOR SELECT TO authenticated
  USING (visibility = 'public' OR public.is_room_member(auth.uid(), id));

-- Fix messages policies
DROP POLICY IF EXISTS "Messages viewable by room members" ON public.messages;
CREATE POLICY "Messages viewable by room members" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_room_member(auth.uid(), room_id));

DROP POLICY IF EXISTS "Members send messages" ON public.messages;
CREATE POLICY "Members send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_room_member(auth.uid(), room_id));

DROP POLICY IF EXISTS "Authors or admins delete messages" ON public.messages;
CREATE POLICY "Authors or admins delete messages" ON public.messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_room_admin(auth.uid(), room_id));

-- Fix message_attachments policies
DROP POLICY IF EXISTS "Attachments viewable" ON public.message_attachments;
CREATE POLICY "Attachments viewable" ON public.message_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_attachments.message_id
    AND public.is_room_member(auth.uid(), m.room_id)
  ));

-- Fix room_bans policies
DROP POLICY IF EXISTS "Admins create room bans" ON public.room_bans;
DROP POLICY IF EXISTS "Admins remove room bans" ON public.room_bans;
DROP POLICY IF EXISTS "Room bans viewable" ON public.room_bans;

CREATE POLICY "Admins create room bans" ON public.room_bans
  FOR INSERT TO authenticated
  WITH CHECK (public.is_room_admin(auth.uid(), room_id));

CREATE POLICY "Admins remove room bans" ON public.room_bans
  FOR DELETE TO authenticated
  USING (public.is_room_admin(auth.uid(), room_id));

CREATE POLICY "Room bans viewable" ON public.room_bans
  FOR SELECT TO authenticated
  USING (public.is_room_admin(auth.uid(), room_id) OR auth.uid() = user_id);

-- Fix room_invitations policies
DROP POLICY IF EXISTS "Members invite" ON public.room_invitations;
CREATE POLICY "Members invite" ON public.room_invitations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = invited_by AND public.is_room_member(auth.uid(), room_id));
