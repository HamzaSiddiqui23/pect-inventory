-- Fix RLS policies for issues table

-- Drop existing policies
DROP POLICY IF EXISTS "Store managers can create issues" ON issues;
DROP POLICY IF EXISTS "Store managers can view issues for their stores" ON issues;
DROP POLICY IF EXISTS "Admins can view all issues" ON issues;

-- Create separate policies for different roles

-- Admins can create issues from any store
CREATE POLICY "Admins can create issues"
  ON issues FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Central store managers can create issues from central store
CREATE POLICY "Central managers can create issues from central store"
  ON issues FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN stores s ON s.type = 'central'
      WHERE up.id = auth.uid() 
        AND up.role = 'central_store_manager'
        AND issues.from_store_id = s.id
    )
  );

-- Project store managers can create issues from their project store
CREATE POLICY "Project managers can create issues from their store"
  ON issues FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN stores s ON s.project_id = up.project_id AND s.type = 'project'
      WHERE up.id = auth.uid() 
        AND up.role = 'project_store_manager'
        AND issues.from_store_id = s.id
    )
  );

-- Fix the SELECT policy for issues as well
CREATE POLICY "Admins can view all issues"
  ON issues FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Central store managers can view all issues
CREATE POLICY "Central managers can view all issues"
  ON issues FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'central_store_manager'
    )
  );

-- Project store managers can view issues for their store
CREATE POLICY "Project managers can view issues for their store"
  ON issues FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN stores s ON s.project_id = up.project_id AND s.type = 'project'
      WHERE up.id = auth.uid() 
        AND up.role = 'project_store_manager'
        AND (issues.from_store_id = s.id OR issues.to_store_id = s.id)
    )
  );

