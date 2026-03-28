
-- Function to delete a user's account and cascade owned rooms
CREATE OR REPLACE FUNCTION public.delete_user_account(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete all messages in rooms owned by this user
  DELETE FROM public.messages WHERE room_id IN (
    SELECT id FROM public.rooms WHERE owner_id = _user_id
  );

  -- Delete all message_attachments in rooms owned by this user
  DELETE FROM public.message_attachments WHERE message_id IN (
    SELECT m.id FROM public.messages m
    JOIN public.rooms r ON m.room_id = r.id
    WHERE r.owner_id = _user_id
  );

  -- Delete room_members of owned rooms
  DELETE FROM public.room_members WHERE room_id IN (
    SELECT id FROM public.rooms WHERE owner_id = _user_id
  );

  -- Delete room_bans of owned rooms
  DELETE FROM public.room_bans WHERE room_id IN (
    SELECT id FROM public.rooms WHERE owner_id = _user_id
  );

  -- Delete room_invitations of owned rooms
  DELETE FROM public.room_invitations WHERE room_id IN (
    SELECT id FROM public.rooms WHERE owner_id = _user_id
  );

  -- Delete call_signals of owned rooms
  DELETE FROM public.call_signals WHERE room_id IN (
    SELECT id FROM public.rooms WHERE owner_id = _user_id
  );

  -- Delete unread_messages of owned rooms
  DELETE FROM public.unread_messages WHERE room_id IN (
    SELECT id FROM public.rooms WHERE owner_id = _user_id
  );

  -- Delete personal_chats linked to owned rooms
  DELETE FROM public.personal_chats WHERE room_id IN (
    SELECT id FROM public.rooms WHERE owner_id = _user_id
  );

  -- Delete owned rooms
  DELETE FROM public.rooms WHERE owner_id = _user_id;

  -- Remove user from all other rooms
  DELETE FROM public.room_members WHERE user_id = _user_id;

  -- Remove friendships
  DELETE FROM public.friends WHERE user_id = _user_id OR friend_id = _user_id;

  -- Remove friend requests
  DELETE FROM public.friend_requests WHERE from_user_id = _user_id OR to_user_id = _user_id;

  -- Remove user bans
  DELETE FROM public.user_bans WHERE banned_by = _user_id OR banned_user = _user_id;

  -- Remove presence
  DELETE FROM public.user_presence WHERE user_id = _user_id;

  -- Remove profile
  DELETE FROM public.profiles WHERE id = _user_id;

  -- Delete the auth user
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;
