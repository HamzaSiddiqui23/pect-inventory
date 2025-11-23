'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CreateProductInput, UpdateProductInput } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/errors'

export async function createProduct(input: CreateProductInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  // Check if a soft-deleted product exists with the same category_id and name
  const { data: existingDeleted } = await supabase
    .from('products')
    .select('id')
    .eq('category_id', input.category_id)
    .eq('name', input.name)
    .not('deleted_at', 'is', null)
    .single()

  let data
  let error

  if (existingDeleted) {
    // Reinstate the soft-deleted product and update its fields
    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update({
        unit: input.unit,
        description: input.description || null,
        restock_level: input.restock_level || 0,
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingDeleted.id)
      .select(`
        *,
        category:categories(*)
      `)
      .single()

    data = updated
    error = updateError
  } else {
    // Create new product
    const { data: inserted, error: insertError } = await supabase
      .from('products')
      .insert({
        category_id: input.category_id,
        name: input.name,
        unit: input.unit,
        description: input.description || null,
        restock_level: input.restock_level || 0,
      })
      .select(`
        *,
        category:categories(*)
      `)
      .single()

    data = inserted
    error = insertError
  }

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/products')
  return { data, error: null }
}

export async function updateProduct(input: UpdateProductInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  const updateData: any = {}
  if (input.category_id !== undefined) updateData.category_id = input.category_id
  if (input.name !== undefined) updateData.name = input.name
  if (input.unit !== undefined) updateData.unit = input.unit
  if (input.description !== undefined) updateData.description = input.description
  if (input.restock_level !== undefined) updateData.restock_level = input.restock_level

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', input.id)
    .select(`
      *,
      category:categories(*)
    `)
    .single()

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/products')
  return { data, error: null }
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  const { error } = await supabase
    .from('products')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq('id', productId)

  if (error) {
    return { error: getErrorMessage(error) }
  }

  revalidatePath('/products')
  return { error: null }
}

export async function getProducts() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(*)
    `)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  return { data, error }
}

export interface CSVProductRow {
  name: string
  category: string
  unit: string
  description?: string
  restock_level?: string
}

export interface ImportProductResult {
  created: number
  skipped: number
  errors: Array<{ row: number; error: string }>
}

export async function importProductsFromCSV(rows: CSVProductRow[]) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Admin access required' }
  }

  // Get all categories to match by name
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .is('deleted_at', null)

  if (!categories || categories.length === 0) {
    return { error: 'No categories found. Please create categories first.' }
  }

  // Create category lookup map (case-insensitive)
  const categoryMap = new Map<string, string>()
  categories.forEach((cat) => {
    categoryMap.set(cat.name.toLowerCase(), cat.id)
  })

  // Get existing active products to check for duplicates
  const { data: existingProducts } = await supabase
    .from('products')
    .select('category_id, name')
    .is('deleted_at', null)

  const existingProductSet = new Set<string>()
  existingProducts?.forEach((prod) => {
    existingProductSet.add(`${prod.category_id}:${prod.name.toLowerCase()}`)
  })

  // Get soft-deleted products to reinstate
  const { data: deletedProducts } = await supabase
    .from('products')
    .select('id, category_id, name')
    .not('deleted_at', 'is', null)

  const deletedProductMap = new Map<string, string>()
  deletedProducts?.forEach((prod) => {
    deletedProductMap.set(`${prod.category_id}:${prod.name.toLowerCase()}`, prod.id)
  })

  // Valid unit types
  const validUnits = [
    'kg', 'g', 'tons', 'pcs', 'units', 'nos', 'coil',
    'm', 'cm', 'km', 'l', 'ml', 'sqm', 'sqft',
    'boxes', 'bags', 'bundles', 'other',
    'length', 'width', 'height', 'diameter', 'radius',
    'area', 'volume', 'weight'
  ]

  const validProducts: Array<{
    category_id: string
    name: string
    unit: string
    description: string | null
    restock_level: number
  }> = []

  const productsToReinstate: Array<{
    id: string
    unit: string
    description: string | null
    restock_level: number
  }> = []

  const errors: Array<{ row: number; error: string }> = []
  let skipped = 0
  let reinstated = 0

  // Validate and prepare products
  rows.forEach((row, index) => {
    const rowNum = index + 2 // +2 because row 1 is header, and index is 0-based

    // Validate name
    const name = row.name?.trim()
    if (!name) {
      errors.push({ row: rowNum, error: 'Product name is required' })
      return
    }

    // Validate category
    const categoryName = row.category?.trim()
    if (!categoryName) {
      errors.push({ row: rowNum, error: 'Category is required' })
      return
    }

    const categoryId = categoryMap.get(categoryName.toLowerCase())
    if (!categoryId) {
      errors.push({ row: rowNum, error: `Category "${categoryName}" not found` })
      return
    }

    // Validate unit
    const unit = row.unit?.trim().toLowerCase()
    if (!unit) {
      errors.push({ row: rowNum, error: 'Unit is required' })
      return
    }

    if (!validUnits.includes(unit)) {
      errors.push({ row: rowNum, error: `Invalid unit "${row.unit}". Must be one of: ${validUnits.join(', ')}` })
      return
    }

    // Validate restock_level
    let restockLevel = 0
    if (row.restock_level) {
      const parsed = parseFloat(row.restock_level.trim())
      if (isNaN(parsed) || parsed < 0) {
        errors.push({ row: rowNum, error: 'Restock level must be a number >= 0' })
        return
      }
      restockLevel = parsed
    }

    // Check for duplicates
    const duplicateKey = `${categoryId}:${name.toLowerCase()}`
    if (existingProductSet.has(duplicateKey)) {
      skipped++
      return // Skip this product (already exists and is active)
    }

    // Check if product is soft-deleted and needs to be reinstated
    const deletedProductId = deletedProductMap.get(duplicateKey)
    if (deletedProductId) {
      // Add to reinstatement list
      productsToReinstate.push({
        id: deletedProductId,
        unit: unit as any,
        description: row.description?.trim() || null,
        restock_level: restockLevel,
      })
      reinstated++
      // Add to existing set to prevent duplicates within the same import
      existingProductSet.add(duplicateKey)
      return
    }

    // Add to valid products (new product)
    validProducts.push({
      category_id: categoryId,
      name: name,
      unit: unit as any,
      description: row.description?.trim() || null,
      restock_level: restockLevel,
    })

    // Add to existing set to prevent duplicates within the same import
    existingProductSet.add(duplicateKey)
  })

  // Reinstate soft-deleted products
  if (productsToReinstate.length > 0) {
    for (const product of productsToReinstate) {
      const { error: reinstateError } = await supabase
        .from('products')
        .update({
          unit: product.unit,
          description: product.description,
          restock_level: product.restock_level,
          deleted_at: null,
          deleted_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)

      if (reinstateError) {
        errors.push({ row: 0, error: `Failed to reinstate product: ${getErrorMessage(reinstateError)}` })
        reinstated-- // Decrement since it failed
      }
    }
  }

  // Insert new products
  let created = 0
  if (validProducts.length > 0) {
    const { error: insertError } = await supabase
      .from('products')
      .insert(validProducts)

    if (insertError) {
      return { error: getErrorMessage(insertError) }
    }

    created = validProducts.length
  }

  revalidatePath('/products')

  return {
    data: {
      created: created + reinstated, // Include reinstated products in created count
      skipped,
      errors,
    } as ImportProductResult,
    error: null,
  }
}

