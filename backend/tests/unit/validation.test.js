import { describe, it, expect } from '@jest/globals'
import { createProductSchema } from '../../src/modules/business/product.validation.js'
import { createSaleSchema } from '../../src/modules/business/sale.validation.js'
import { createCustomerSchema } from '../../src/modules/business/customer.validation.js'
import { createSupplierSchema } from '../../src/modules/business/supplier.validation.js'
import { createExpenseSchema } from '../../src/modules/business/expense.validation.js'

describe('Domain Validation Schemas (Zod)', () => {
  describe('Product Validation', () => {
    it('validates and transforms product SKU to uppercase', () => {
      const parsed = createProductSchema.parse({
        sku: '  sku-abc-123  ',
        name: 'Fine Tweed Cap',
        sellingPrice: 25.00,
      })
      expect(parsed.sku).toBe('SKU-ABC-123')
      expect(parsed.category).toBe('General Merchandise')
      expect(parsed.costPrice).toBe(0)
    })

    it('rejects negative selling price', () => {
      expect(() => {
        createProductSchema.parse({
          sku: 'SKU-1',
          name: 'Invalid Price Cap',
          sellingPrice: -10,
        })
      }).toThrow()
    })
  })

  describe('Sale Validation', () => {
    it('accepts valid sale payload with items', () => {
      const parsed = createSaleSchema.parse({
        items: [{ productSku: 'sku-100', quantity: 2, unitPrice: 15.00 }],
      })
      expect(parsed.items[0].productSku).toBe('SKU-100')
      expect(parsed.items[0].quantity).toBe(2)
      expect(parsed.status).toBe('completed')
    })

    it('rejects sale with empty items array', () => {
      expect(() => {
        createSaleSchema.parse({ items: [] })
      }).toThrow()
    })
  })

  describe('Customer Validation', () => {
    it('accepts customer payload and trims fields', () => {
      const parsed = createCustomerSchema.parse({
        customerId: ' CUST-999 ',
        name: ' Arthur Conan ',
      })
      expect(parsed.customerId).toBe('CUST-999')
      expect(parsed.name).toBe('Arthur Conan')
      expect(parsed.country).toBe('United Kingdom')
    })
  })

  describe('Supplier Validation', () => {
    it('validates supplier details and defaults lead time', () => {
      const parsed = createSupplierSchema.parse({
        name: 'Moray Mills',
        email: 'info@moraymills.co.uk',
      })
      expect(parsed.leadTimeDays).toBe(7)
      expect(parsed.minimumOrderQty).toBe(50)
    })
  })

  describe('Expense Validation', () => {
    it('accepts valid operating expense', () => {
      const parsed = createExpenseSchema.parse({
        category: 'Utilities',
        amount: 150.75,
        description: 'Gas & Power Bill',
      })
      expect(parsed.amount).toBe(150.75)
      expect(parsed.paymentMethod).toBe('Direct Debit')
    })

    it('rejects non-positive expense amount', () => {
      expect(() => {
        createExpenseSchema.parse({
          category: 'Utilities',
          amount: 0,
          description: 'Zero bill',
        })
      }).toThrow()
    })
  })
})
