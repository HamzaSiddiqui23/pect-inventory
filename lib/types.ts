export type UserRole = 'admin' | 'central_store_manager' | 'project_store_manager'
export type StoreType = 'central' | 'project'
export type UnitType = 'kg' | 'g' | 'tons' | 'pcs' | 'units' | 'm' | 'cm' | 'km' | 'l' | 'ml' | 'sqm' | 'sqft' | 'boxes' | 'bags' | 'bundles' | 'other'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  project_id: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  location: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  category_id: string
  name: string
  unit: UnitType
  description: string | null
  restock_level: number
  created_at: string
  updated_at: string
  category?: Category
}

export interface Store {
  id: string
  name: string
  type: StoreType
  project_id: string | null
  created_at: string
  updated_at: string
  project?: Project
}

export interface Purchase {
  id: string
  store_id: string
  product_id: string
  quantity: number
  unit_cost: number
  total_cost: number
  purchase_date: string
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  store?: Store
  product?: Product
}

export interface InventoryItem {
  id: string
  store_id: string
  product_id: string
  quantity: number
  updated_at: string
  store?: Store
  product?: Product
  average_cost?: number
  needsRestock?: boolean // Computed: quantity <= product.restock_level
}

export interface Issue {
  id: string
  from_store_id: string
  to_store_id: string | null
  product_id: string
  quantity: number
  issued_to_name: string | null
  issue_date: string
  notes: string | null
  created_by: string
  created_at: string
  unit_cost?: number | null // Cost per unit at time of issue (for store-to-store transfers)
  total_cost?: number | null // Total cost at time of issue (for store-to-store transfers)
  from_store?: Store
  to_store?: Store
  product?: Product
}

export interface CreateUserInput {
  email: string
  password: string
  full_name?: string
  role: UserRole
  project_id?: string | null
}

export interface UpdateUserInput {
  id: string
  full_name?: string
  role?: UserRole
  project_id?: string | null
}

export interface CreateProjectInput {
  name: string
  description?: string
  location?: string
  status?: string
}

export interface UpdateProjectInput {
  id: string
  name?: string
  description?: string
  location?: string
  status?: string
}

export interface CreateCategoryInput {
  name: string
  description?: string
}

export interface UpdateCategoryInput {
  id: string
  name?: string
  description?: string
}

export interface CreateProductInput {
  category_id: string
  name: string
  unit: UnitType
  description?: string
  restock_level?: number
}

export interface UpdateProductInput {
  id: string
  category_id?: string
  name?: string
  unit?: UnitType
  description?: string
  restock_level?: number
}

export interface CreatePurchaseInput {
  store_id: string
  product_id: string
  quantity: number
  unit_cost: number
  purchase_date?: string
  notes?: string
}

export interface UpdatePurchaseInput {
  id: string
  store_id?: string
  product_id?: string
  quantity?: number
  unit_cost?: number
  purchase_date?: string
  notes?: string
}

export interface CreateIssueInput {
  from_store_id: string
  to_store_id?: string | null
  product_id: string
  quantity: number
  issued_to_name?: string
  issue_date?: string
  notes?: string
}

