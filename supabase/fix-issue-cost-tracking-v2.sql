-- Fix: Track cost on issues and include in average cost calculation
-- This approach is more intuitive - we track the cost at which items were issued
-- without creating fake purchase records

-- Step 1: Add cost columns to issues table (only relevant when issuing to another store)
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10, 2) CHECK (unit_cost >= 0),
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10, 2) CHECK (total_cost >= 0);

-- Step 2: Create trigger to calculate and store cost BEFORE insert
CREATE OR REPLACE FUNCTION public.calculate_issue_cost()
RETURNS TRIGGER AS $$
DECLARE
  source_avg_cost DECIMAL(10, 2);
BEGIN
  -- If issuing to another store, calculate and store the cost
  IF NEW.to_store_id IS NOT NULL THEN
    -- Get average cost from source store for cost tracking
    SELECT COALESCE(
      (SELECT get_average_cost(NEW.from_store_id, NEW.product_id)),
      0
    ) INTO source_avg_cost;
    
    -- Store the cost in the issue record itself
    NEW.unit_cost := source_avg_cost;
    NEW.total_cost := source_avg_cost * NEW.quantity;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2b: Update the inventory trigger (separate from cost calculation)
CREATE OR REPLACE FUNCTION public.update_inventory_on_issue()
RETURNS TRIGGER AS $$
BEGIN
  -- Reduce quantity from source store
  UPDATE public.inventory_items
  SET 
    quantity = quantity - NEW.quantity,
    updated_at = NOW()
  WHERE store_id = NEW.from_store_id AND product_id = NEW.product_id;
  
  -- Add quantity to destination store if to_store_id is provided
  IF NEW.to_store_id IS NOT NULL THEN
    -- Add quantity to destination store inventory
    INSERT INTO public.inventory_items (store_id, product_id, quantity)
    VALUES (NEW.to_store_id, NEW.product_id, NEW.quantity)
    ON CONFLICT (store_id, product_id)
    DO UPDATE SET
      quantity = inventory_items.quantity + NEW.quantity,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old triggers and create new ones
DROP TRIGGER IF EXISTS on_issue_cost_calculation ON issues;
CREATE TRIGGER on_issue_cost_calculation
  BEFORE INSERT ON issues
  FOR EACH ROW EXECUTE FUNCTION public.calculate_issue_cost();

DROP TRIGGER IF EXISTS on_issue_created ON issues;
CREATE TRIGGER on_issue_created
  AFTER INSERT ON issues
  FOR EACH ROW EXECUTE FUNCTION public.update_inventory_on_issue();

-- Step 3: Update get_average_cost to include issued items
CREATE OR REPLACE FUNCTION public.get_average_cost(p_store_id UUID, p_product_id UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  avg_cost DECIMAL(10, 2);
  total_qty DECIMAL(10, 2);
  total_cost DECIMAL(10, 2);
  purchase_qty DECIMAL(10, 2);
  purchase_cost DECIMAL(10, 2);
  issue_qty DECIMAL(10, 2);
  issue_cost DECIMAL(10, 2);
BEGIN
  -- Calculate from purchases (actual purchases)
  SELECT 
    COALESCE(SUM(p.quantity), 0),
    COALESCE(SUM(p.total_cost), 0)
  INTO purchase_qty, purchase_cost
  FROM purchases p
  WHERE p.store_id = p_store_id AND p.product_id = p_product_id;
  
  -- Calculate from issued items (transfers from other stores)
  SELECT 
    COALESCE(SUM(i.quantity), 0),
    COALESCE(SUM(i.total_cost), 0)
  INTO issue_qty, issue_cost
  FROM issues i
  WHERE i.to_store_id = p_store_id 
    AND i.product_id = p_product_id
    AND i.unit_cost IS NOT NULL; -- Only count issues that were issued to a store (have cost)
  
  -- Combine purchases and issues
  total_qty := purchase_qty + issue_qty;
  total_cost := purchase_cost + issue_cost;
  
  -- Calculate weighted average
  IF total_qty > 0 THEN
    avg_cost := total_cost / total_qty;
  ELSE
    avg_cost := 0;
  END IF;
  
  RETURN COALESCE(avg_cost, 0);
END;
$$ LANGUAGE plpgsql STABLE;

