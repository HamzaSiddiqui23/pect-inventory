-- Inventory Management Schema
-- Run this after the main schema.sql

-- Create store_type enum
CREATE TYPE store_type AS ENUM ('central', 'project');

-- Create units enum (standardized units)
CREATE TYPE unit_type AS ENUM (
  'kg', 'g', 'tons',
  'pcs', 'units', 'nos',
  'coil',
  'm', 'cm', 'km',
  'l', 'ml',
  'sqm', 'sqft',
  'boxes', 'bags', 'bundles',
  'other',
  'length', 'width', 'height', 'diameter', 'radius',
  'area', 'volume', 'weight'
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  unit unit_type NOT NULL DEFAULT 'pcs',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category_id, name)
);

-- Create stores table (central store + project stores)
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type store_type NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id) -- One store per project
);

-- Create purchases table (purchase history with variable costs)
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
  unit_cost DECIMAL(10, 2) NOT NULL CHECK (unit_cost >= 0),
  total_cost DECIMAL(10, 2) NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory_items table (current stock per store)
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, product_id)
);

-- Create issues table (tracking items issued)
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  to_store_id UUID REFERENCES stores(id) ON DELETE SET NULL, -- NULL if issuing to project (not to another store)
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
  issued_to_name TEXT, -- Name of person/team receiving (for project store issues)
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unit_cost DECIMAL(10, 2) CHECK (unit_cost >= 0), -- Cost per unit at time of issue (for store-to-store transfers)
  total_cost DECIMAL(10, 2) CHECK (total_cost >= 0) -- Total cost at time of issue (for store-to-store transfers)
);

-- Create trigger to automatically create store when project is created
CREATE OR REPLACE FUNCTION public.create_project_store()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.stores (name, type, project_id)
  VALUES (
    NEW.name || ' Store',
    'project',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION public.create_project_store();

-- Multiple central stores can now be created manually via the UI
-- The auto-create trigger has been removed to allow multiple central stores
-- Use the Central Stores management page (admin only) to create stores like:
-- - Central Store - Karachi
-- - Central Store - Islamabad

-- Create trigger to update inventory when purchase is made
CREATE OR REPLACE FUNCTION public.update_inventory_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.inventory_items (store_id, product_id, quantity)
  VALUES (NEW.store_id, NEW.product_id, NEW.quantity)
  ON CONFLICT (store_id, product_id)
  DO UPDATE SET
    quantity = inventory_items.quantity + NEW.quantity,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_purchase_created ON purchases;
CREATE TRIGGER on_purchase_created
  AFTER INSERT ON purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_inventory_on_purchase();

-- Create trigger to update inventory when purchase is updated
CREATE OR REPLACE FUNCTION public.update_inventory_on_purchase_update()
RETURNS TRIGGER AS $$
DECLARE
  qty_diff DECIMAL(10, 2);
BEGIN
  -- If store or product changed, adjust both old and new locations
  IF OLD.store_id IS DISTINCT FROM NEW.store_id OR OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    -- Remove from old location
    UPDATE public.inventory_items
    SET 
      quantity = quantity - OLD.quantity,
      updated_at = NOW()
    WHERE store_id = OLD.store_id AND product_id = OLD.product_id;
    
    -- Add to new location
    INSERT INTO public.inventory_items (store_id, product_id, quantity)
    VALUES (NEW.store_id, NEW.product_id, NEW.quantity)
    ON CONFLICT (store_id, product_id)
    DO UPDATE SET
      quantity = inventory_items.quantity + NEW.quantity,
      updated_at = NOW();
  ELSE
    -- Just quantity changed, adjust difference
    qty_diff := NEW.quantity - OLD.quantity;
    
    UPDATE public.inventory_items
    SET 
      quantity = quantity + qty_diff,
      updated_at = NOW()
    WHERE store_id = NEW.store_id AND product_id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_purchase_updated ON purchases;
CREATE TRIGGER on_purchase_updated
  AFTER UPDATE ON purchases
  FOR EACH ROW
  WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity OR OLD.product_id IS DISTINCT FROM NEW.product_id OR OLD.store_id IS DISTINCT FROM NEW.store_id)
  EXECUTE FUNCTION public.update_inventory_on_purchase_update();

-- Create trigger to reverse inventory when purchase is deleted
CREATE OR REPLACE FUNCTION public.reverse_inventory_on_purchase_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.inventory_items
  SET 
    quantity = quantity - OLD.quantity,
    updated_at = NOW()
  WHERE store_id = OLD.store_id AND product_id = OLD.product_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_purchase_deleted ON purchases;
CREATE TRIGGER on_purchase_deleted
  AFTER DELETE ON purchases
  FOR EACH ROW EXECUTE FUNCTION public.reverse_inventory_on_purchase_delete();

-- Create trigger to calculate and store cost BEFORE insert
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

-- Create trigger to update inventory AFTER insert
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

DROP TRIGGER IF EXISTS on_issue_cost_calculation ON issues;
CREATE TRIGGER on_issue_cost_calculation
  BEFORE INSERT ON issues
  FOR EACH ROW EXECUTE FUNCTION public.calculate_issue_cost();

DROP TRIGGER IF EXISTS on_issue_created ON issues;
CREATE TRIGGER on_issue_created
  AFTER INSERT ON issues
  FOR EACH ROW EXECUTE FUNCTION public.update_inventory_on_issue();

-- Create function to calculate average cost for a product in a store
-- Includes both purchases and issued items (transfers from other stores)
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

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories (all authenticated users can view, only admins can modify)
CREATE POLICY "Everyone can view categories"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (public.is_admin());

-- RLS Policies for products (all authenticated users can view, only admins can modify)
CREATE POLICY "Everyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  TO authenticated
  USING (public.is_admin());

-- RLS Policies for stores
CREATE POLICY "Admins can view all stores"
  ON stores FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Everyone can view stores"
  ON stores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage stores"
  ON stores FOR ALL
  TO authenticated
  USING (public.is_admin());

-- RLS Policies for purchases
-- Admins and central store managers can view all purchases
-- Project store managers can only see purchases for their store
CREATE POLICY "Admins and central managers can view all purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'central_store_manager'
    )
  );

CREATE POLICY "Project managers can view their store purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN stores s ON s.project_id = up.project_id
      WHERE up.id = auth.uid() 
        AND up.role = 'project_store_manager'
        AND purchases.store_id = s.id
    )
  );

CREATE POLICY "Central store managers can create purchases for central store"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN stores s ON s.type = 'central'
      WHERE up.id = auth.uid() 
        AND up.role IN ('admin', 'central_store_manager')
        AND purchases.store_id = s.id
    )
  );

CREATE POLICY "Admins can update purchases"
  ON purchases FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- RLS Policies for inventory_items
-- Admins can see all with prices
-- Central store managers can see all without prices
-- Project store managers can only see their store
CREATE POLICY "Admins can view all inventory with prices"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Central managers can view all inventory without prices"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'central_store_manager'
    )
  );

CREATE POLICY "Project managers can view their store inventory"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN stores s ON s.project_id = up.project_id
      WHERE up.id = auth.uid() 
        AND up.role = 'project_store_manager'
        AND inventory_items.store_id = s.id
    )
  );

-- RLS Policies for issues
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

-- Admins can view all issues
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

-- Create updated_at triggers
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

