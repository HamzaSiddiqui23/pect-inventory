-- Extend unit_type enum with additional allowed values for new purchasing workflow
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'nos';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'coil';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'length';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'width';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'height';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'diameter';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'radius';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'area';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'volume';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'weight';


