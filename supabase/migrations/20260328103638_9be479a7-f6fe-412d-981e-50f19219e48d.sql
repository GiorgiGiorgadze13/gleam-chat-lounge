
-- Unique room names
ALTER TABLE public.rooms ADD CONSTRAINT rooms_name_unique UNIQUE (name);

-- Prevent username changes via trigger
CREATE OR REPLACE FUNCTION public.prevent_username_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    RAISE EXCEPTION 'Username cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_username_change_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_username_change();

-- Prevent banned users from joining rooms (RLS update)
-- Drop existing join policy and replace with ban-aware version
DROP POLICY IF EXISTS "Users join rooms" ON public.room_members;

CREATE POLICY "Users join rooms" ON public.room_members
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.room_bans
    WHERE room_bans.room_id = room_members.room_id
    AND room_bans.user_id = auth.uid()
  )
);

-- Prevent joining private rooms without invitation
-- We'll enforce this at the application level + add a check
CREATE OR REPLACE FUNCTION public.can_join_room(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    -- Public rooms: anyone can join (unless banned, handled by RLS)
    EXISTS (SELECT 1 FROM public.rooms WHERE id = _room_id AND visibility = 'public')
    OR
    -- Private rooms: must have invitation
    EXISTS (SELECT 1 FROM public.room_invitations WHERE room_id = _room_id AND invited_user_id = _user_id)
    OR
    -- Owner always can
    EXISTS (SELECT 1 FROM public.rooms WHERE id = _room_id AND owner_id = _user_id)
  )
$$;
