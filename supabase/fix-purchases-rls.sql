-- Fix RLS policies for purchases INSERT
-- This script adds missing policies to allow project store managers to create purchases
-- and fixes the existing policy for central store managers

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Central store managers can create purchases for central store" ON purchases;
DROP POLICY IF EXISTS "Admins can create purchases" ON purchases;
DROP POLICY IF EXISTS "Project store managers can create purchases for their store" ON purchases;

-- Policy for admins: can create purchases for any store
CREATE POLICY "Admins can create purchases"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
  );

-- Policy for central store managers: can create purchases for central stores only
CREATE POLICY "Central store managers can create purchases for central store"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN stores s ON s.id = purchases.store_id
      WHERE up.id = auth.uid() 
        AND up.role = 'central_store_manager'
        AND s.type = 'central'
        AND s.deleted_at IS NULL
    )
  );

-- Policy for project store managers: can create purchases for their project store only
CREATE POLICY "Project store managers can create purchases for their store"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN stores s ON s.id = purchases.store_id
      WHERE up.id = auth.uid() 
        AND up.role = 'project_store_manager'
        AND s.type = 'project'
        AND s.project_id = up.project_id
        AND s.deleted_at IS NULL
    )
  );

