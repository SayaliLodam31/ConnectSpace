-- ==============================================================================
-- Fix & Harden handle_new_user Trigger for Supabase Auth Signup
-- ==============================================================================

-- Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
  -- Extract user metadata safely
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

  -- Insert profile with conflict handling
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
  -- Prevent profile insertion errors from crashing auth.users signup
  RAISE WARNING 'handle_new_user trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Ensure trigger is properly bound to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
