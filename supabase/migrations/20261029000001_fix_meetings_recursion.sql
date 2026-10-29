-- ==============================================================================
-- Migration: 20261029000001_fix_meetings_recursion.sql
-- Scope: Strictly replaces the two circular SELECT policies on public.meetings
--        and public.meeting_participants using a non-recursive SECURITY DEFINER
--        helper in the internal app_private schema.
-- ==============================================================================

-- 1. Create internal schema for RLS helpers (isolated from PostgREST API)
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

-- 2. Non-recursive meeting membership check (UUID signature)
CREATE OR REPLACE FUNCTION app_private.is_meeting_member(p_meeting_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_meeting_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Check if user is host of the meeting (bypasses RLS recursion)
  IF EXISTS (
    SELECT 1 
    FROM public.meetings 
    WHERE id = p_meeting_id AND host_id = p_user_id
  ) THEN
    RETURN true;
  END IF;

  -- 2. Check if user is a registered participant (bypasses RLS recursion)
  IF EXISTS (
    SELECT 1 
    FROM public.meeting_participants 
    WHERE meeting_id = p_meeting_id AND user_id = p_user_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 3. Non-recursive meeting membership check (Text signature for folder paths)
CREATE OR REPLACE FUNCTION app_private.is_meeting_member(p_meeting_id_text text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_meeting_id_text IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Validate standard UUID regex pattern before casting
  IF NOT (p_meeting_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RETURN false;
  END IF;

  RETURN app_private.is_meeting_member(p_meeting_id_text::uuid, p_user_id);
END;
$$;

-- Enforce function ownership and minimal execution permissions
ALTER FUNCTION app_private.is_meeting_member(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.is_meeting_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_meeting_member(uuid, uuid) TO authenticated, service_role;

ALTER FUNCTION app_private.is_meeting_member(text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.is_meeting_member(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_meeting_member(text, uuid) TO authenticated, service_role;

-- 4. Replace Policy 1: public.meetings SELECT Policy
-- Eliminates direct subquery to public.meeting_participants
DROP POLICY IF EXISTS "Users can view accessible meetings" ON public.meetings;
CREATE POLICY "Users can view accessible meetings"
ON public.meetings FOR SELECT
TO authenticated
USING (
  host_id = auth.uid() OR
  app_private.is_meeting_member(id, auth.uid()) OR
  id IN (
    SELECT meeting_id FROM public.meeting_invitations 
    WHERE invitee_id = auth.uid() OR invitee_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);

-- 5. Replace Policy 2: public.meeting_participants SELECT Policy
-- Eliminates cross-table query to public.meetings and self-referential subquery
DROP POLICY IF EXISTS "Participants can view meeting members" ON public.meeting_participants;
CREATE POLICY "Participants can view meeting members"
ON public.meeting_participants FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  app_private.is_meeting_member(meeting_id, auth.uid())
);

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
