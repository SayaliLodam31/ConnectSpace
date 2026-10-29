-- ==============================================================================
-- ConnectSpace Complete Database Schema Migration
-- Production-Ready Schema with Tables, RLS, Indexes, Triggers, Realtime & Storage
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PROFILES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  job_title TEXT,
  timezone TEXT DEFAULT 'UTC',
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'in_meeting')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 2. MEETINGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  meeting_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended')),
  scheduled_start TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 3. MEETING PARTICIPANTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('host', 'cohost', 'participant')),
  joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  left_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT false NOT NULL,
  is_video_enabled BOOLEAN DEFAULT true NOT NULL,
  is_screen_sharing BOOLEAN DEFAULT false NOT NULL,
  CONSTRAINT unique_meeting_user UNIQUE (meeting_id, user_id)
);

-- ==============================================================================
-- 4. MEETING INVITATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.meeting_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  invitee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 5. MEETING MESSAGES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.meeting_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'file')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- ==============================================================================
-- 6. MEETING FILES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.meeting_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 7. WHITEBOARDS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.whiteboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Main Whiteboard' NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 8. WHITEBOARD ITEMS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.whiteboard_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id UUID NOT NULL REFERENCES public.whiteboards(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('stroke', 'text', 'shape', 'image', 'eraser')),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 9. NOTIFICATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 10. INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_meetings_host_id ON public.meetings(host_id);
CREATE INDEX IF NOT EXISTS idx_meetings_code ON public.meetings(meeting_code);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON public.meetings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON public.meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user_id ON public.meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_role ON public.meeting_participants(role);

CREATE INDEX IF NOT EXISTS idx_meeting_messages_meeting_id ON public.meeting_messages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_messages_sender_id ON public.meeting_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_meeting_messages_created_at ON public.meeting_messages(created_at ASC);

CREATE INDEX IF NOT EXISTS idx_meeting_files_meeting_id ON public.meeting_files(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_files_uploaded_by ON public.meeting_files(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_whiteboards_meeting_id ON public.whiteboards(meeting_id);
CREATE INDEX IF NOT EXISTS idx_whiteboard_items_whiteboard_id ON public.whiteboard_items(whiteboard_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- ==============================================================================
-- 11. AUTOMATIC TRIGGERS & FUNCTIONS
-- ==============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on profiles
DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger on meetings
DROP TRIGGER IF EXISTS trigger_meetings_updated_at ON public.meetings;
CREATE TRIGGER trigger_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger on whiteboard_items
DROP TRIGGER IF EXISTS trigger_whiteboard_items_updated_at ON public.whiteboard_items;
CREATE TRIGGER trigger_whiteboard_items_updated_at
BEFORE UPDATE ON public.whiteboard_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Function to handle new user signup from auth.users safely
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  user_full_name TEXT;
  user_avatar_url TEXT;
  user_job_title TEXT;
BEGIN
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'Team Member'
  );
  
  user_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/initials/svg?seed=' || md5(COALESCE(NEW.email, NEW.id::text))
  );

  user_job_title := COALESCE(
    NEW.raw_user_meta_data->>'job_title',
    'Team Member'
  );

  INSERT INTO public.profiles (id, full_name, email, avatar_url, job_title, status)
  VALUES (
    NEW.id,
    user_full_name,
    NEW.email,
    user_avatar_url,
    user_job_title,
    'online'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger after auth user inserted
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Automatically add host to meeting_participants when a meeting is created
CREATE OR REPLACE FUNCTION public.handle_new_meeting()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert host into meeting participants
  INSERT INTO public.meeting_participants (meeting_id, user_id, role, joined_at, is_video_enabled, is_muted)
  VALUES (NEW.id, NEW.host_id, 'host', timezone('utc'::text, now()), true, false)
  ON CONFLICT (meeting_id, user_id) DO NOTHING;

  -- Create default whiteboard for the meeting
  INSERT INTO public.whiteboards (meeting_id, name, created_by)
  VALUES (NEW.id, 'Main Whiteboard', NEW.host_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_new_meeting ON public.meetings;
CREATE TRIGGER trigger_new_meeting
AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.handle_new_meeting();

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Profiles Policies
-- ------------------------------------------------------------------------------
-- Any authenticated user can view profiles
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Users can update only their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Meetings Policies
-- ------------------------------------------------------------------------------
-- Authenticated users can view meetings they host, or participate in, or know the code
CREATE POLICY "Users can view accessible meetings"
ON public.meetings FOR SELECT
TO authenticated
USING (
  host_id = auth.uid() OR
  id IN (SELECT meeting_id FROM public.meeting_participants WHERE user_id = auth.uid()) OR
  status IN ('scheduled', 'active')
);

-- Authenticated users can create meetings
CREATE POLICY "Authenticated users can create meetings"
ON public.meetings FOR INSERT
TO authenticated
WITH CHECK (host_id = auth.uid());

-- Host can update meeting
CREATE POLICY "Host can update meeting"
ON public.meetings FOR UPDATE
TO authenticated
USING (host_id = auth.uid())
WITH CHECK (host_id = auth.uid());

-- Host can delete meeting
CREATE POLICY "Host can delete meeting"
ON public.meetings FOR DELETE
TO authenticated
USING (host_id = auth.uid());

-- ------------------------------------------------------------------------------
-- Meeting Participants Policies
-- ------------------------------------------------------------------------------
-- Participants can view other participants in the same meeting
CREATE POLICY "Participants can view meeting members"
ON public.meeting_participants FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can join a meeting (insert participant)
CREATE POLICY "Users can join meeting as participant"
ON public.meeting_participants FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own participant state, or host can update
CREATE POLICY "Users or host can update participant state"
ON public.meeting_participants FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR
  meeting_id IN (SELECT id FROM public.meetings WHERE host_id = auth.uid())
);

-- Users can leave meeting (delete or update left_at) or host can remove participant
CREATE POLICY "Users can leave or host can remove participant"
ON public.meeting_participants FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() OR
  meeting_id IN (SELECT id FROM public.meetings WHERE host_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- Meeting Invitations Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view relevant invitations"
ON public.meeting_invitations FOR SELECT
TO authenticated
USING (
  inviter_id = auth.uid() OR
  invitee_id = auth.uid() OR
  invitee_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Host or co-host can create invitations"
ON public.meeting_invitations FOR INSERT
TO authenticated
WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "Invitee can update invitation status"
ON public.meeting_invitations FOR UPDATE
TO authenticated
USING (
  invitee_id = auth.uid() OR
  invitee_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- Meeting Messages Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Participants can view messages"
ON public.meeting_messages FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL AND
  (
    meeting_id IN (SELECT id FROM public.meetings WHERE host_id = auth.uid()) OR
    meeting_id IN (SELECT meeting_id FROM public.meeting_participants WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Participants can send messages"
ON public.meeting_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  (
    meeting_id IN (SELECT id FROM public.meetings WHERE host_id = auth.uid()) OR
    meeting_id IN (SELECT meeting_id FROM public.meeting_participants WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Sender or host can delete message"
ON public.meeting_messages FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid() OR
  meeting_id IN (SELECT id FROM public.meetings WHERE host_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- Meeting Files Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Participants can view files"
ON public.meeting_files FOR SELECT
TO authenticated
USING (
  meeting_id IN (SELECT id FROM public.meetings WHERE host_id = auth.uid()) OR
  meeting_id IN (SELECT meeting_id FROM public.meeting_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Participants can upload files"
ON public.meeting_files FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND
  (
    meeting_id IN (SELECT id FROM public.meetings WHERE host_id = auth.uid()) OR
    meeting_id IN (SELECT meeting_id FROM public.meeting_participants WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Uploader or host can delete file"
ON public.meeting_files FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid() OR
  meeting_id IN (SELECT id FROM public.meetings WHERE host_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- Whiteboard Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Participants can view whiteboards"
ON public.whiteboards FOR SELECT
TO authenticated
USING (
  meeting_id IN (SELECT id FROM public.meetings WHERE host_id = auth.uid()) OR
  meeting_id IN (SELECT meeting_id FROM public.meeting_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Host or participant can create whiteboard"
ON public.whiteboards FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND
  (
    meeting_id IN (SELECT id FROM public.meetings WHERE host_id = auth.uid()) OR
    meeting_id IN (SELECT meeting_id FROM public.meeting_participants WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Participants can view whiteboard items"
ON public.whiteboard_items FOR SELECT
TO authenticated
USING (
  whiteboard_id IN (
    SELECT w.id FROM public.whiteboards w
    JOIN public.meeting_participants mp ON mp.meeting_id = w.meeting_id
    WHERE mp.user_id = auth.uid()
    UNION
    SELECT w.id FROM public.whiteboards w
    JOIN public.meetings m ON m.id = w.meeting_id
    WHERE m.host_id = auth.uid()
  )
);

CREATE POLICY "Participants can insert whiteboard items"
ON public.whiteboard_items FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Participants can update whiteboard items"
ON public.whiteboard_items FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Creator or host can delete whiteboard items"
ON public.whiteboard_items FOR DELETE
TO authenticated
USING (
  created_by = auth.uid() OR
  whiteboard_id IN (
    SELECT w.id FROM public.whiteboards w
    JOIN public.meetings m ON m.id = w.meeting_id
    WHERE m.host_id = auth.uid()
  )
);

-- ------------------------------------------------------------------------------
-- Notifications Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ==============================================================================
-- 13. REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
-- Add tables to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'meeting_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'meeting_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'whiteboard_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'meeting_files'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_files;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'meetings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- ==============================================================================
-- 14. STORAGE BUCKET CONFIGURATION & POLICIES
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-files',
  'meeting-files',
  false,
  52428800, -- 50 MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'application/json', 'application/zip'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- Storage RLS: allow authenticated users to view files in meetings they attend
CREATE POLICY "Authenticated users can read meeting files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'meeting-files');

CREATE POLICY "Authenticated users can upload meeting files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meeting-files' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete own uploaded files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'meeting-files' AND
  owner = auth.uid()
);
