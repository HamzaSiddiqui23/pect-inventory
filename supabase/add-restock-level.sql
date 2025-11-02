-- Add restock_level column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS restock_level DECIMAL(10, 2) DEFAULT 0 CHECK (restock_level >= 0);

