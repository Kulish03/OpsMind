import Product from './product.model.js'
import Sale from './sale.model.js'
import Customer from './customer.model.js'
import Expense from './expense.model.js'
import AppError from '../../utils/AppError.js'

/**
 * Lightweight, robust CSV line parser supporting quoted fields and commas
 */
export const parseCSV = (csvString) => {
  if (!csvString || typeof csvString !== 'string') return []

  const lines = csvString
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0)

  if (lines.length < 2) return []

  const parseRow = (line) => {
    const result = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseRow(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim())
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i])
    if (values.length === headers.length) {
      const row = {}
      headers.forEach((h, idx) => {
        row[h] = values[idx].replace(/^["']|["']$/g, '').trim()
      })
      rows.push(row)
    }
  }

  return rows
}

/**
 * Universal Data Importer for Products, Sales, Customers, and Expenses
 */
export const importEntities = async (businessId, entityType, input) => {
  let records = []
  if (typeof input === 'string') {
    records = parseCSV(input)
  } else if (Array.isArray(input)) {
    records = input
  } else if (input && Array.isArray(input.records)) {
    records = input.records
  } else {
    throw new AppError('Invalid input format. Provide CSV text or JSON array.', 400)
  }

  if (records.length === 0) {
    throw new AppError('No valid rows found in import data.', 400)
  }

  let importedCount = 0
  let skippedCount = 0
  const errors = []

  switch (entityType.toLowerCase()) {
    case 'products': {
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const sku = (r.sku || r.SKU || r.StockCode || '').toUpperCase().trim()
        const name = r.name || r.Name || r.Description || 'Imported Product'
        const costPrice = Number(r.costPrice || r.Cost || 0)
        const sellingPrice = Number(r.sellingPrice || r.Price || r.UnitPrice || 0)
        const currentStock = Number(r.currentStock || r.Stock || r.Quantity || 0)
        const category = r.category || r.Category || 'General'

        if (!sku) {
          skippedCount++
          errors.push({ row: i + 1, error: 'Missing product SKU' })
          continue
        }

        try {
          await Product.findOneAndUpdate(
            { businessId, sku },
            {
              businessId,
              sku,
              name,
              category,
              costPrice: isNaN(costPrice) ? 0 : costPrice,
              sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
              currentStock: isNaN(currentStock) ? 0 : currentStock,
              reorderThreshold: Number(r.reorderThreshold || 20),
              source: 'user_created',
              isActive: true,
            },
            { upsert: true, new: true }
          )
          importedCount++
        } catch (err) {
          skippedCount++
          errors.push({ row: i + 1, sku, error: err.message })
        }
      }
      break
    }

    case 'customers': {
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const customerId = r.customerId || r.CustomerID || r.id || `CUST-${Date.now()}-${i}`
        const name = r.name || r.Name || `Customer ${customerId}`
        const email = r.email || r.Email || `customer_${customerId}@import.opsmind.io`

        try {
          await Customer.findOneAndUpdate(
            { businessId, customerId: String(customerId) },
            {
              businessId,
              customerId: String(customerId),
              name,
              email,
              phone: r.phone || r.Phone || '',
              country: r.country || r.Country || 'United Kingdom',
            },
            { upsert: true, new: true }
          )
          importedCount++
        } catch (err) {
          skippedCount++
          errors.push({ row: i + 1, error: err.message })
        }
      }
      break
    }

    case 'expenses': {
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const amount = Number(r.amount || r.Amount || 0)
        const category = r.category || r.Category || 'Other'
        const description = r.description || r.Description || 'Imported Expense'
        const expenseDate = r.date ? new Date(r.date) : new Date()

        if (isNaN(amount) || amount <= 0) {
          skippedCount++
          errors.push({ row: i + 1, error: 'Expense amount must be positive' })
          continue
        }

        try {
          await Expense.create({
            businessId,
            expenseId: r.expenseId || `EXP-IMP-${Date.now()}-${i}`,
            category,
            amount,
            description,
            date: expenseDate,
            paymentMethod: r.paymentMethod || 'BANK_TRANSFER',
          })
          importedCount++
        } catch (err) {
          skippedCount++
          errors.push({ row: i + 1, error: err.message })
        }
      }
      break
    }

    case 'sales': {
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const invoiceId = r.invoiceId || r.InvoiceNo || `INV-IMP-${Date.now()}-${i}`
        const sku = (r.sku || r.StockCode || 'GENERAL').toUpperCase().trim()
        const qty = Number(r.quantity || r.Quantity || 1)
        const price = Number(r.unitPrice || r.UnitPrice || 0)
        const total = Number(r.totalAmount || r.Total || qty * price)

        try {
          await Sale.create({
            businessId,
            invoiceId,
            transactionDate: r.date ? new Date(r.date) : new Date(),
            customerReference: r.customerId || 'GUEST',
            billingCountry: r.country || 'United Kingdom',
            items: [
              {
                productSku: sku,
                productName: r.name || r.Description || sku,
                quantity: qty,
                unitPrice: price,
                lineTotal: total,
              },
            ],
            totalAmount: total,
            totalUnits: Math.abs(qty),
            status: qty < 0 ? 'refunded' : 'completed',
            isCancellation: qty < 0,
          })
          importedCount++
        } catch (err) {
          skippedCount++
          errors.push({ row: i + 1, error: err.message })
        }
      }
      break
    }

    default:
      throw new AppError(
        `Unsupported entity type: '${entityType}'. Allowed: 'products', 'customers', 'expenses', 'sales'`,
        400
      )
  }

  return {
    entityType,
    totalRows: records.length,
    importedCount,
    skippedCount,
    errors,
  }
}
