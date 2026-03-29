
-- 1. Auto-remove membership when a room ban is created
CREATE OR REPLACE FUNCTION public.on_room_ban_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.room_members
  WHERE room_id = NEW.room_id AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_room_ban_remove_member
  AFTER INSERT ON public.room_bans
  FOR EACH ROW
  EXECUTE FUNCTION public.on_room_ban_created();

-- 2. Auto-freeze personal chats when a user-to-user ban is created
CREATE OR REPLACE FUNCTION public.on_user_ban_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.personal_chats
  SET is_frozen = true
  WHERE (user1_id = NEW.banned_by AND user2_id = NEW.banned_user)
     OR (user1_id = NEW.banned_user AND user2_id = NEW.banned_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_ban_freeze_chat
  AFTER INSERT ON public.user_bans
  FOR EACH ROW
  EXECUTE FUNCTION public.on_user_ban_created();

-- 3. Auto-unfreeze personal chats when a user-to-user ban is removed
CREATE OR REPLACE FUNCTION public.on_user_ban_removed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only unfreeze if no remaining ban in either direction
  IF NOT EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE (banned_by = OLD.banned_by AND banned_user = OLD.banned_user)
       OR (banned_by = OLD.banned_user AND banned_user = OLD.banned_by)
  ) THEN
    UPDATE public.personal_chats
    SET is_frozen = false
    WHERE (user1_id = OLD.banned_by AND user2_id = OLD.banned_user)
       OR (user1_id = OLD.banned_user AND user2_id = OLD.banned_by);
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_user_ban_unfreeze_chat
  AFTER DELETE ON public.user_bans
  FOR EACH ROW
  EXECUTE FUNCTION public.on_user_ban_removed();

-- 4. Update can_join_room to also check bans
CREATE OR REPLACE FUNCTION public.can_join_room(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    -- Not banned
    NOT EXISTS (SELECT 1 FROM public.room_bans WHERE room_id = _room_id AND user_id = _user_id)
    AND (
      -- Public rooms
      EXISTS (SELECT 1 FROM public.rooms WHERE id = _room_id AND visibility = 'public')
      OR
      -- Private rooms with invitation
      EXISTS (SELECT 1 FROM public.room_invitations WHERE room_id = _room_id AND invited_user_id = _user_id)
      OR
      -- Owner
      EXISTS (SELECT 1 FROM public.rooms WHERE id = _room_id AND owner_id = _user_id)
    )
$$;

-- 5. Prevent sending messages in frozen personal chats
CREATE OR REPLACE FUNCTION public.check_frozen_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.personal_chats
    WHERE room_id = NEW.room_id AND is_frozen = true
  ) THEN
    RAISE EXCEPTION 'This chat is frozen due to a user ban';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_frozen_before_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_frozen_chat();
