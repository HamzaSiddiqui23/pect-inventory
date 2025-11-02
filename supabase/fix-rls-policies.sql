-- This script fixes RLS policies and resolves infinite recursion issues
-- Run this in Supabase SQL Editor if you're getting "infinite recursion" errors

-- Create helper function to check if current user is admin (to avoid recursion)
-- This function uses SECURITY DEFINER to bypass RLS when checking admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop existing policies (if needed)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
DROP POLICY IF EXISTS "Admins can insert projects" ON projects;
DROP POLICY IF EXISTS "Admins can update projects" ON projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON projects;

-- Recreate the policy for users to view their own profile
-- This should work even if other policies fail
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Recreate admin policies using the helper function (avoids recursion)
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (public.is_admin());

-- Recreate project policies
CREATE POLICY "Admins can view all projects"
  ON projects FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert projects"
  ON projects FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  USING (public.is_admin());

-- Verify the policies work by testing
-- You can run this query to check if you can see your profile:
-- SELECT * FROM user_profiles WHERE id = auth.uid();

