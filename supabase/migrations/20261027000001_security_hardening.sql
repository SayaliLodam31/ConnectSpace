-- ==============================================================================
-- ConnectSpace Security Hardening & Authorization Migration
-- Date: 2026-10-27
-- Description: 
--   1. Restricts public.meetings SELECT to hosts, participants, and invitees (prevents global enumeration).
--   2. Restricts public.meeting_participants SELECT to meeting members (prevents global participant snooping).
--   3. Restricts public.whiteboard_items INSERT to verified meeting participants.
--   4. Restricts storage.objects to authorized meeting participants based on folder meeting_id.
--   5. Adds secure join_meeting_by_code() RPC for authorized entry by code.
-- ==============================================================================

-- 1. Tighten public.meetings SELECT Policy
DROP POLICY IF EXISTS "Users can view accessible meetings" ON public.meetings;
CREATE POLICY "Users can view accessible meetings"
ON public.meetings FOR SELECT
TO authenticated
USING (
  host_id = auth.uid() OR
  id IN (SELECT meeting_id FROM public.meeting_participants WHERE user_id = auth.uid()) OR
  id IN (
    SELECT meeting_id FROM public.meeting_invitations 
    WHERE invitee_id = auth.uid() OR invitee_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);

-- 2. Tighten public.meeting_participants SELECT Policy
DROP POLICY IF EXISTS "Participants can view meeting members" ON public.meeting_participants;
CREATE POLICY "Participants can view meeting members"
ON public.meeting_participants FOR SELECT
TO authenticated
USING (
  meeting_id IN (SELECT id FROM public.meetings WHERE host_id = auth.uid()) OR
  meeting_id IN (SELECT meeting_id FROM public.meeting_participants WHERE user_id = auth.uid())
);

-- 3. Tighten public.whiteboard_items INSERT Policy
DROP POLICY IF EXISTS "Participants can insert whiteboard items" ON public.whiteboard_items;
CREATE POLICY "Participants can insert whiteboard items"
ON public.whiteboard_items FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND
  whiteboard_id IN (
    SELECT w.id FROM public.whiteboards w
    JOIN public.meetings m ON m.id = w.meeting_id
    WHERE m.host_id = auth.uid()
    UNION
    SELECT w.id FROM public.whiteboards w
    JOIN public.meeting_participants mp ON mp.meeting_id = w.meeting_id
    WHERE mp.user_id = auth.uid()
  )
);

-- 4. Secure RPC function for joining by code
CREATE OR REPLACE FUNCTION public.join_meeting_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  m_record public.meetings%ROWTYPE;
  u_id uuid;
  p_role text;
BEGIN
  u_id := auth.uid();
  IF u_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Match either meeting_code or UUID string
  SELECT * INTO m_record
  FROM public.meetings
  WHERE (meeting_code = p_code OR id::text = p_code)
    AND status IN ('scheduled', 'active')
  LIMIT 1;

  IF m_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Meeting not found or has concluded');
  END IF;

  -- Determine host vs participant role
  p_role := CASE WHEN m_record.host_id = u_id THEN 'host' ELSE 'participant' END;

  -- Register or update user in meeting_participants
  INSERT INTO public.meeting_participants (
    meeting_id,
    user_id,
    role,
    joined_at,
    is_video_enabled,
    is_muted,
    is_screen_sharing
  )
  VALUES (
    m_record.id,
    u_id,
    p_role,
    now(),
    true,
    false,
    false
  )
  ON CONFLICT (meeting_id, user_id) DO UPDATE
  SET 
    role = p_role,
    left_at = NULL,
    joined_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'meeting_id', m_record.id,
    'meeting_code', m_record.meeting_code,
    'title', m_record.title,
    'host_id', m_record.host_id,
    'status', m_record.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_meeting_by_code(text) TO authenticated;

-- 5. Tighten Storage Policies for meeting-files bucket
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read meeting files" ON storage.objects;
  DROP POLICY IF EXISTS "Participants can read meeting files in storage" ON storage.objects;
  CREATE POLICY "Participants can read meeting files in storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'meeting-files' AND
    (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.meetings WHERE host_id = auth.uid()
        UNION
        SELECT meeting_id::text FROM public.meeting_participants WHERE user_id = auth.uid()
      )
    )
  );

  DROP POLICY IF EXISTS "Authenticated users can upload meeting files" ON storage.objects;
  DROP POLICY IF EXISTS "Participants can upload meeting files to storage" ON storage.objects;
  CREATE POLICY "Participants can upload meeting files to storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'meeting-files' AND
    (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.meetings WHERE host_id = auth.uid()
        UNION
        SELECT meeting_id::text FROM public.meeting_participants WHERE user_id = auth.uid()
      )
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage policy configuration notice: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
