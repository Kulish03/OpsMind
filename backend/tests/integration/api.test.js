import dotenv from 'dotenv'
dotenv.config()

import request from 'supertest'
import mongoose from 'mongoose'
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals'
import connectDB from '../../src/config/db.js'
import app from '../../src/app.js'
import { User, Business } from '../../src/modules/auth/index.js'
import { Product, Sale, InventoryMovement, Customer, Supplier, Expense } from '../../src/modules/business/index.js'
import { generateToken } from '../../src/modules/auth/auth.service.js'

describe('OpsMind API End-to-End Integration Suite (Supertest)', () => {
  const tenantId = `tenant_jest_${Date.now()}`
  let adminToken
  let staffToken
  let createdProductId
  let createdCustomerId
  let createdSupplierId
  let createdExpenseId

  beforeAll(async () => {
    await connectDB()

    // Seed test business tenant
    await Business.create({
      businessId: tenantId,
      name: 'Jest Test Haberdashery',
      businessType: 'retail',
      currency: 'GBP',
    })

    // Seed Admin
    const admin = await User.create({
      businessId: tenantId,
      name: 'Alice JestAdmin',
      email: `admin_${Date.now()}@jesttest.com`,
      password: 'AdminPassword123!',
      role: 'admin',
    })
    adminToken = generateToken(admin)

    // Seed Staff
    const staff = await User.create({
      businessId: tenantId,
      name: 'Sam JestStaff',
      email: `staff_${Date.now()}@jesttest.com`,
      password: 'StaffPassword123!',
      role: 'staff',
    })
    staffToken = generateToken(staff)
  })

  afterAll(async () => {
    // Cleanup all tenant test artifacts
    await Product.deleteMany({ businessId: tenantId })
    await Sale.deleteMany({ businessId: tenantId })
    await InventoryMovement.deleteMany({ businessId: tenantId })
    await Customer.deleteMany({ businessId: tenantId })
    await Supplier.deleteMany({ businessId: tenantId })
    await Expense.deleteMany({ businessId: tenantId })
    await User.deleteMany({ businessId: tenantId })
    await Business.deleteMany({ businessId: tenantId })

    await mongoose.connection.close()
  })

  // 1. Health & Base Endpoints
  describe('System Endpoints', () => {
    it('GET /api/health should report healthy status with MongoDB connected', async () => {
      const res = await request(app).get('/api/health')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.database.status).toBe('connected')
    })

    it('GET / should return OpsMind welcome message', async () => {
      const res = await request(app).get('/')
      expect(res.status).toBe(200)
      expect(res.body.data.project).toContain('OpsMind')
    })
  })

  // 2. Authentication Flow
  describe('Authentication Module', () => {
    it('GET /api/auth/me should return authenticated user profile and strip password', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.user.role).toBe('admin')
      expect(res.body.data.user.businessId).toBe(tenantId)
      expect(res.body.data.user.password).toBeUndefined()
    })

    it('GET /api/auth/me should reject requests without token with HTTP 401', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })
  })

  // 3. Business Profile & Tenancy
  describe('Business Module', () => {
    it('GET /api/businesses/profile should fetch business profile for authenticated tenant', async () => {
      const res = await request(app)
        .get('/api/businesses/profile')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.businessId).toBe(tenantId)
      expect(res.body.data.currency).toBe('GBP')
    })

    it('PUT /api/businesses/profile should update settings for admin', async () => {
      const res = await request(app)
        .put('/api/businesses/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          settings: { defaultLowStockThreshold: 30 },
        })

      expect(res.status).toBe(200)
      expect(res.body.data.settings.defaultLowStockThreshold).toBe(30)
    })

    it('PUT /api/businesses/profile should block staff with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .put('/api/businesses/profile')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Unauthorized Mutation' })

      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
    })
  })

  // 4. Products Module
  describe('Product CRUD APIs', () => {
    it('POST /api/products should create product and uppercase SKU', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: 'twd-101',
          name: 'Harris Tweed Flat Cap',
          category: 'Hats & Headwear',
          sellingPrice: 35.00,
          costPrice: 15.00,
          currentStock: 50,
          reorderThreshold: 15,
          targetStock: 100,
        })

      expect(res.status).toBe(201)
      expect(res.body.data.sku).toBe('TWD-101')
      expect(res.body.data.businessId).toBe(tenantId)
      createdProductId = res.body.data._id
    })

    it('POST /api/products should reject duplicate SKU within tenant with HTTP 409', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: 'TWD-101',
          name: 'Duplicate Cap',
          sellingPrice: 35.00,
        })

      expect(res.status).toBe(409)
    })

    it('GET /api/products should return paginated product list', async () => {
      const res = await request(app)
        .get('/api/products?page=1&limit=10')
        .set('Authorization', `Bearer ${staffToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.products.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1)
    })

    it('PUT /api/products/:id should update selling price', async () => {
      const res = await request(app)
        .put(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sellingPrice: 39.95 })

      expect(res.status).toBe(200)
      expect(res.body.data.sellingPrice).toBe(39.95)
    })
  })

  // 5. Sales & Inventory Lifecycle
  describe('Sales & Inventory Module', () => {
    it('POST /api/sales should record transaction and deduct stock from Product', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          invoiceId: 'INV-JEST-001',
          customerReference: 'GUEST',
          items: [{ productSku: 'TWD-101', quantity: 2 }],
        })

      expect(res.status).toBe(201)
      expect(res.body.data.totalAmount).toBe(79.90) // 2 * 39.95
      expect(res.body.data.totalUnits).toBe(2)

      // Verify Product currentStock was reduced from 50 to 48
      const product = await Product.findById(createdProductId)
      expect(product.currentStock).toBe(48)
    })

    it('GET /api/inventory should reflect stock deduction and compute valuation', async () => {
      const res = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${staffToken}`)

      expect(res.status).toBe(200)
      const item = res.body.data.inventory.find((p) => p.sku === 'TWD-101')
      expect(item).toBeDefined()
      expect(item.currentStock).toBe(48)
      expect(item.inventoryValue).toBe(720.00) // 48 * 15
    })

    it('POST /api/inventory/adjust should adjust stock level and log movement', async () => {
      const res = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productSku: 'TWD-101',
          newStock: 46,
          reason: 'Cycle count variance (-2 units)',
        })

      expect(res.status).toBe(200)
      expect(res.body.data.currentStock).toBe(46)
      expect(res.body.data.adjustmentDelta).toBe(-2)
    })

    it('GET /api/inventory/movements should return audit ledger records', async () => {
      const res = await request(app)
        .get('/api/inventory/movements/TWD-101')
        .set('Authorization', `Bearer ${staffToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.movements.length).toBeGreaterThanOrEqual(2) // Sale outflow + Adjustment
    })
  })

  // 6. Customers Module
  describe('Customer CRUD APIs', () => {
    it('POST /api/customers should create customer profile', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerId: 'CUST-JEST-1',
          name: 'Lady Margaret',
          country: 'United Kingdom',
        })

      expect(res.status).toBe(201)
      expect(res.body.data.customerId).toBe('CUST-JEST-1')
      createdCustomerId = res.body.data._id
    })

    it('GET /api/customers should list customers with search', async () => {
      const res = await request(app)
        .get('/api/customers?search=margaret')
        .set('Authorization', `Bearer ${staffToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.customers.length).toBe(1)
    })
  })

  // 7. Suppliers Module
  describe('Supplier CRUD APIs', () => {
    it('POST /api/suppliers should register a new vendor', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierId: 'SUP-JEST-1',
          name: 'Highland Woollens Ltd',
          category: 'Textiles',
          leadTimeDays: 10,
          minimumOrderQty: 20,
        })

      expect(res.status).toBe(201)
      expect(res.body.data.supplierId).toBe('SUP-JEST-1')
      createdSupplierId = res.body.data._id
    })

    it('GET /api/suppliers/summary should return supplier directory metrics', async () => {
      const res = await request(app)
        .get('/api/suppliers/summary')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.totalSuppliers).toBeGreaterThanOrEqual(1)
      expect(res.body.data.averageLeadTimeDays).toBeGreaterThan(0)
    })
  })

  // 8. Expenses Module
  describe('Expense CRUD APIs', () => {
    it('POST /api/expenses should record operating expense', async () => {
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          expenseId: 'EXP-JEST-1',
          category: 'Utilities',
          amount: 120.00,
          description: 'Heating and power',
          paymentMethod: 'Direct Debit',
        })

      expect(res.status).toBe(201)
      expect(res.body.data.amount).toBe(120.00)
      createdExpenseId = res.body.data._id
    })

    it('GET /api/expenses/summary should return category and monthly breakdown', async () => {
      const res = await request(app)
        .get('/api/expenses/summary')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.totalExpensesAmount).toBeGreaterThanOrEqual(120.00)
      expect(res.body.data.categoryBreakdown.length).toBeGreaterThanOrEqual(1)
    })
  })

  // 9. Analytics Module
  describe('Analytics Calculation Endpoints', () => {
    it('GET /api/analytics/kpis should compute financial and operational metrics', async () => {
      const res = await request(app)
        .get('/api/analytics/kpis')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.revenueAndOrders.totalRevenue).toBe(79.90)
      expect(res.body.data.revenueAndOrders.totalOrders).toBe(1)
      expect(res.body.data.profitability.grossProfit).toBeDefined()
      expect(res.body.data.profitability.totalOperatingExpenses).toBe(120.00)
    })

    it('GET /api/analytics/top-products should rank best sellers', async () => {
      const res = await request(app)
        .get('/api/analytics/top-products')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.topProducts.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data.topProducts[0].sku).toBe('TWD-101')
    })

    it('GET /api/analytics/inventory-health should report stockout alerts', async () => {
      const res = await request(app)
        .get('/api/analytics/inventory-health')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.capitalTiedInInventory).toBeGreaterThan(0)
    })
  })
})
