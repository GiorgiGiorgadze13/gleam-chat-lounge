
-- Drop old overly-permissive storage policies
DROP POLICY IF EXISTS "Auth read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload attachments" ON storage.objects;

-- Upload: authenticated users can upload to chat-attachments/{room_id}/
CREATE POLICY "Room members upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND public.is_room_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Read: room members can view files in their room's folder
CREATE POLICY "Room members read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.is_room_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Delete: admins can delete attachments
CREATE POLICY "Room admins delete attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.is_room_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);
