-- Update RLS policies to respect soft deletes
-- This ensures that soft-deleted records are not visible in queries
-- Note: RLS policies automatically apply, but we should also ensure
-- that our queries filter deleted records for performance

-- For user_profiles: Update SELECT policies to exclude soft-deleted records
-- The existing policies should work, but we'll add explicit checks in queries
-- RLS policies will handle access control, but queries should filter deleted_at

-- For projects: Update policies if needed
-- Policies already exist, queries will filter deleted_at

-- For categories: Update policies if needed  
-- Policies already exist, queries will filter deleted_at

-- For products: Update policies if needed
-- Policies already exist, queries will filter deleted_at

-- For purchases: Update policies if needed
-- Policies already exist, queries will filter deleted_at

-- For stores: Update policies if needed
-- Policies already exist, queries will filter deleted_at

-- For issues: Update policies if needed
-- Policies already exist, queries will filter deleted_at

-- Note: Since we're adding .is('deleted_at', null) filters in all queries,
-- and RLS policies control access, we don't need to modify RLS policies themselves.
-- However, if you want to add explicit deleted_at checks in policies for extra safety:

-- Example for categories (optional - queries already filter):
-- DROP POLICY IF EXISTS "Categories are viewable by authenticated users" ON categories;
-- CREATE POLICY "Categories are viewable by authenticated users"
--   ON categories FOR SELECT
--   TO authenticated
--   USING (deleted_at IS NULL);

-- We'll rely on query-level filtering for now since it's more performant
-- and we've already updated all queries to include .is('deleted_at', null)

-- For trigger updates: The purchase deletion trigger needs updating
-- since we're now soft-deleting purchases instead of hard-deleting them

-- Update the purchase deletion trigger to handle soft deletes
-- When deleted_at is set (soft delete), we still want to reverse inventory
DROP TRIGGER IF EXISTS reverse_inventory_on_purchase_delete ON purchases;

-- Create a new trigger that fires on UPDATE when deleted_at is set
CREATE OR REPLACE FUNCTION reverse_inventory_on_purchase_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if deleted_at changed from NULL to a timestamp (soft delete)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- Reverse the inventory impact (subtract the quantity from inventory)
    UPDATE inventory_items
    SET quantity = quantity - NEW.quantity
    WHERE store_id = NEW.store_id
      AND product_id = NEW.product_id;
    
    -- If quantity becomes 0 or negative, we keep the record (it's already there from the purchase)
    -- Negative quantities might indicate data integrity issues, but we'll preserve them for audit
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER reverse_inventory_on_purchase_soft_delete
  AFTER UPDATE OF deleted_at ON purchases
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION reverse_inventory_on_purchase_soft_delete();

-- Note: We also need to handle the case where deleted_at is cleared (restore)
-- For now, we'll not auto-restore inventory, admin can manually adjust if needed
-- If you want to auto-restore when undeleted, add another trigger:

-- CREATE OR REPLACE FUNCTION restore_inventory_on_purchase_undelete()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   -- Only process if deleted_at changed from a timestamp to NULL (undelete)
--   IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
--     -- Restore the inventory impact (add back the quantity)
--     UPDATE inventory_items
--     SET quantity = quantity + NEW.quantity
--     WHERE store_id = NEW.store_id
--       AND product_id = NEW.product_id;
--   END IF;
--   
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- CREATE TRIGGER restore_inventory_on_purchase_undelete
--   AFTER UPDATE OF deleted_at ON purchases
--   FOR EACH ROW
--   WHEN (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL)
--   EXECUTE FUNCTION restore_inventory_on_purchase_undelete();

