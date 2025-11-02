-- Update RLS policy for project store managers to allow viewing their store + all central stores inventory (without prices)
-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Project managers can view their store inventory" ON inventory_items;
DROP POLICY IF EXISTS "Project managers can view all inventory without prices" ON inventory_items;
DROP POLICY IF EXISTS "Project managers can view their store and central store inventory" ON inventory_items;

-- Create new policy that allows project store managers to view their own store OR any central store
CREATE POLICY "Project managers can view their store and all central stores inventory"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN stores s ON s.project_id = up.project_id
      WHERE up.id = auth.uid() 
        AND up.role = 'project_store_manager'
        AND (
          -- Their own project store
          inventory_items.store_id = s.id
          OR
          -- Any central store
          EXISTS (
            SELECT 1 FROM stores central_store
            WHERE central_store.id = inventory_items.store_id
              AND central_store.type = 'central'
          )
        )
    )
  );

