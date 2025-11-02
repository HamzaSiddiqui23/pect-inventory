-- Fix: Update issue trigger to create purchase records for cost tracking
-- This ensures that when items are issued from central store to project stores,
-- the project store has purchase history showing the cost, which allows
-- proper calculation of average cost and inventory value.

CREATE OR REPLACE FUNCTION public.update_inventory_on_issue()
RETURNS TRIGGER AS $$
DECLARE
  source_avg_cost DECIMAL(10, 2);
  from_store_name TEXT;
BEGIN
  -- Reduce quantity from source store
  UPDATE public.inventory_items
  SET 
    quantity = quantity - NEW.quantity,
    updated_at = NOW()
  WHERE store_id = NEW.from_store_id AND product_id = NEW.product_id;
  
  -- Add quantity to destination store if to_store_id is provided
  IF NEW.to_store_id IS NOT NULL THEN
    -- Get average cost from source store for cost tracking
    SELECT COALESCE(
      (SELECT get_average_cost(NEW.from_store_id, NEW.product_id)),
      0
    ) INTO source_avg_cost;
    
    -- Get source store name for notes
    SELECT name INTO from_store_name
    FROM stores
    WHERE id = NEW.from_store_id;
    
    -- Create a purchase record in the destination store to track cost
    -- This ensures cost and value are properly reflected in reports
    -- Note: The purchase trigger will automatically update inventory_items
    INSERT INTO public.purchases (
      store_id,
      product_id,
      quantity,
      unit_cost,
      total_cost,
      purchase_date,
      notes,
      created_by
    )
    VALUES (
      NEW.to_store_id,
      NEW.product_id,
      NEW.quantity,
      source_avg_cost,
      source_avg_cost * NEW.quantity,
      NEW.issue_date,
      'Issued from ' || COALESCE(from_store_name, 'Central Store'),
      NEW.created_by
    );
    
    -- Inventory update is handled automatically by the purchase trigger
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

