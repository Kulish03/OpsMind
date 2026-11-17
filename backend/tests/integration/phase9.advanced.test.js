import request from 'supertest'
import mongoose from 'mongoose'
import app from '../../src/app.js'
import connectDB from '../../src/config/db.js'
import { User, Business } from '../../src/modules/auth/index.js'
import { generateToken } from '../../src/modules/auth/auth.service.js'
import Product from '../../src/modules/business/product.model.js'
import Supplier from '../../src/modules/business/supplier.model.js'
import Recommendation from '../../src/modules/recommendations/recommendation.model.js'
import BusinessDocument from '../../src/modules/documents/businessDocument.model.js'
import ReportSchedule from '../../src/modules/reports/reportSchedule.model.js'
import Sale from '../../src/modules/business/sale.model.js'
import Expense from '../../src/modules/business/expense.model.js'

describe('OpsMind Phase 9 Advanced Features Integration Suite', () => {
  const testBusinessId = 'phase9_advanced_tenant'
  let tokenAdmin
  let tokenManager
  let tokenStaff
  let sampleRec

  beforeAll(async () => {
    await connectDB()

    // Setup Tenant
    await Business.findOneAndUpdate(
      { businessId: testBusinessId },
      {
        businessId: testBusinessId,
        name: 'Phase 9 Advanced Enterprise',
        businessType: 'retail',
        currency: 'GBP',
      },
      { upsert: true, new: true }
    )

    // Setup Admin User
    const userAdmin = await User.findOneAndUpdate(
      { email: 'admin_p9@opsmind.io' },
      {
        name: 'Phase 9 Admin',
        email: 'admin_p9@opsmind.io',
        password: 'Password123!',
        role: 'admin',
        businessId: testBusinessId,
      },
      { upsert: true, new: true }
    )
    tokenAdmin = generateToken(userAdmin)

    // Setup Manager User
    const userManager = await User.findOneAndUpdate(
      { email: 'manager_p9@opsmind.io' },
      {
        name: 'Phase 9 Manager',
        email: 'manager_p9@opsmind.io',
        password: 'Password123!',
        role: 'manager',
        businessId: testBusinessId,
      },
      { upsert: true, new: true }
    )
    tokenManager = generateToken(userManager)

    // Setup Staff User
    const userStaff = await User.findOneAndUpdate(
      { email: 'staff_p9@opsmind.io' },
      {
        name: 'Phase 9 Staff',
        email: 'staff_p9@opsmind.io',
        password: 'Password123!',
        role: 'staff',
        businessId: testBusinessId,
      },
      { upsert: true, new: true }
    )
    tokenStaff = generateToken(userStaff)

    // Setup a supplier for lead time testing
    await Supplier.findOneAndUpdate(
      { businessId: testBusinessId, supplierId: 'SUP-P9-01' },
      {
        businessId: testBusinessId,
        supplierId: 'SUP-P9-01',
        name: 'Caledonian Logistics & Distro',
        category: 'Packaging',
        contactPerson: 'Fiona MacLeod',
        email: 'fiona@caledonian.co.uk',
        leadTimeDays: 7,
        minimumOrderQty: 50,
      },
      { upsert: true, new: true }
    )

    // Setup a test product
    await Product.findOneAndUpdate(
      { businessId: testBusinessId, sku: 'P9-SKU-01' },
      {
        businessId: testBusinessId,
        sku: 'P9-SKU-01',
        name: 'Phase 9 Luxury Ceramic Teapot',
        costPrice: 15.0,
        sellingPrice: 35.0,
        currentStock: 5,
        reorderThreshold: 20,
      },
      { upsert: true, new: true }
    )

    // Setup an applied recommendation for impact tracking
    sampleRec = await Recommendation.create({
      businessId: testBusinessId,
      title: 'Restock Ceramic Teapots',
      type: 'INVENTORY_REORDER',
      category: 'Inventory',
      severity: 'CRITICAL',
      urgency: 'IMMEDIATE',
      status: 'APPLIED',
      reason: 'Low stock below threshold.',
      estimatedImpact: {
        metric: 'Protected Sales Revenue',
        amount: 700,
        currency: 'GBP',
      },
      action: {
        actionType: 'PURCHASE_ORDER',
        targetEntity: {
          entityType: 'product',
          entityId: 'P9-SKU-01',
          sku: 'P9-SKU-01',
          name: 'Phase 9 Luxury Ceramic Teapot',
        },
        suggestedPayload: { orderQty: 20 },
        isConsequential: true,
        requiresConfirmation: true,
      },
    })
  })

  afterAll(async () => {
    // Clean up test data
    await Business.deleteMany({ businessId: testBusinessId })
    await User.deleteMany({ businessId: testBusinessId })
    await Product.deleteMany({ businessId: testBusinessId })
    await Supplier.deleteMany({ businessId: testBusinessId })
    await Recommendation.deleteMany({ businessId: testBusinessId })
    await BusinessDocument.deleteMany({ businessId: testBusinessId })
    await ReportSchedule.deleteMany({ businessId: testBusinessId })
    await Sale.deleteMany({ businessId: testBusinessId })
    await Expense.deleteMany({ businessId: testBusinessId })
    await mongoose.connection.close()
  })

  // ==========================================================================
  // 1. Feature 5: Advanced Business Roles & Permissions (RBAC)
  // ==========================================================================
  describe('RBAC Roles & Permissions', () => {
    it('Blocks staff users from executing consequential operations with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/recommendations/${sampleRec._id}/execute`)
        .set('Authorization', `Bearer ${tokenStaff}`)
        .send({ confirmed: true })

      expect(res.status).toBe(403)
      expect(res.body.message).toContain('Forbidden')
    })

    it('Allows manager users to access consequential execution routes', async () => {
      const res = await request(app)
        .post(`/api/recommendations/${sampleRec._id}/execute`)
        .set('Authorization', `Bearer ${tokenManager}`)
        .send({ confirmed: true })

      // Status 400 is expected because recommendation is already APPLIED, proving RBAC authorization passed!
      expect([200, 400]).toContain(res.status)
      expect(res.status).not.toBe(403)
    })
  })

  // ==========================================================================
  // 2. Feature 1: CSV Bulk Ingestion Engine
  // ==========================================================================
  describe('CSV & Bulk Ingestion Engine', () => {
    it('Imports products via CSV text format', async () => {
      const csvData = `sku,name,category,costPrice,sellingPrice,currentStock\nCSV-PROD-01,Handcrafted Coffee Press,Kitchen,12.50,28.00,45\nCSV-PROD-02,Artisan Tea Infuser,Kitchen,4.20,12.00,80`

      const res = await request(app)
        .post('/api/import/products')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .set('Content-Type', 'text/plain')
        .send(csvData)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.importedCount).toBe(2)

      // Verify product was created in MongoDB
      const prod = await Product.findOne({ businessId: testBusinessId, sku: 'CSV-PROD-01' })
      expect(prod).toBeTruthy()
      expect(prod.sellingPrice).toBe(28.0)
    })

    it('Imports expenses via JSON array format', async () => {
      const payload = {
        records: [
          { amount: 150, category: 'Utilities', description: 'Warehouse electricity bill' },
          { amount: 320, category: 'Software', description: 'Operations cloud hosting' },
        ],
      }

      const res = await request(app)
        .post('/api/import/expenses')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(payload)

      expect(res.status).toBe(200)
      expect(res.body.data.importedCount).toBe(2)
    })
  })

  // ==========================================================================
  // 3. Feature 2: PDF Business Reports Engine
  // ==========================================================================
  describe('PDF Business Reports Generator', () => {
    it('GET /api/reports/executive-summary/pdf - streams valid binary PDF', async () => {
      const res = await request(app)
        .get('/api/reports/executive-summary/pdf')
        .set('Authorization', `Bearer ${tokenAdmin}`)

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('application/pdf')
      expect(res.headers['content-disposition']).toContain('OpsMind-Executive-Report')
      expect(res.body.length).toBeGreaterThan(500)
    })

    it('GET /api/reports/executive-summary/preview - returns JSON report preview', async () => {
      const res = await request(app)
        .get('/api/reports/executive-summary/preview')
        .set('Authorization', `Bearer ${tokenAdmin}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('financialMetrics')
      expect(res.body.data).toHaveProperty('businessName')
    })
  })

  // ==========================================================================
  // 4. Feature 3: RAG for Business Documents & Policies
  // ==========================================================================
  describe('RAG Document Indexing & Copilot Policy Grounding', () => {
    it('Indexes a business return policy with semantic chunking', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          title: 'Customer Return & Refund Policy 2026',
          category: 'POLICY',
          content:
            'All items may be returned within 30 days of purchase for a full refund if accompanied by original receipt. Damaged goods require photo evidence within 48 hours. Clearance and customized items are non-refundable.',
        })

      expect(res.status).toBe(201)
      expect(res.body.data.title).toBe('Customer Return & Refund Policy 2026')
      expect(res.body.data.chunks.length).toBeGreaterThan(0)
    })

    it('Queries policy excerpts grounded via semantic search', async () => {
      const res = await request(app)
        .post('/api/documents/query')
        .set('Authorization', `Bearer ${tokenStaff}`)
        .send({ query: 'Can customers return damaged goods within 48 hours?' })

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThan(0)
      expect(res.body.data[0].excerptText).toContain('within 30 days')
    })

    it('AI Copilot invokes query_business_documents when asked about store policy', async () => {
      const res = await request(app)
        .post('/api/copilot/chat')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ message: 'What is our policy on customer returns and refunds?' })

      expect(res.status).toBe(200)
      expect(res.body.data.toolCalls[0].toolName).toBe('query_business_documents')
      expect(res.body.data.reply).toContain('Grounded Business Document Excerpts')
    })
  })

  // ==========================================================================
  // 5. Feature 4: Supplier Lead-Time Analysis
  // ==========================================================================
  describe('Supplier Lead-Time Analysis', () => {
    it('GET /api/analytics/suppliers/lead-time - computes SLA variance and reliability tier', async () => {
      const res = await request(app)
        .get('/api/analytics/suppliers/lead-time')
        .set('Authorization', `Bearer ${tokenAdmin}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('totalSuppliersEvaluated')
      expect(res.body.data.suppliers.length).toBeGreaterThan(0)
      const sup = res.body.data.suppliers[0]
      expect(sup).toHaveProperty('statedLeadTimeDays')
      expect(sup).toHaveProperty('reliabilityTier')
      expect(sup).toHaveProperty('bufferStockDaysRecommended')
    })
  })

  // ==========================================================================
  // 6. Feature 6: Scheduled Reports & Automated Notifications
  // ==========================================================================
  describe('Scheduled Reports Engine', () => {
    let scheduleId

    it('Creates an automated weekly executive digest schedule', async () => {
      const res = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          reportType: 'EXECUTIVE_SUMMARY',
          frequency: 'WEEKLY',
          recipients: ['owner@opsmind.io'],
        })

      expect(res.status).toBe(201)
      expect(res.body.data.reportType).toBe('EXECUTIVE_SUMMARY')
      scheduleId = res.body.data._id
    })

    it('Triggers on-demand execution of scheduled report and logs history', async () => {
      const res = await request(app)
        .post(`/api/reports/schedules/${scheduleId}/trigger`)
        .set('Authorization', `Bearer ${tokenAdmin}`)

      expect(res.status).toBe(200)
      expect(res.body.data.schedule.executionHistory.length).toBe(1)
      expect(res.body.data.schedule.executionHistory[0].status).toBe('SUCCESS')
    })
  })

  // ==========================================================================
  // 7. Feature 9: Accounting & POS Integrations
  // ==========================================================================
  describe('POS & Accounting Webhook Sync Layer', () => {
    it('Ingests real-time POS transaction, deducts inventory, and logs movement', async () => {
      const initialStock = (await Product.findOne({ businessId: testBusinessId, sku: 'P9-SKU-01' })).currentStock

      const res = await request(app)
        .post('/api/integrations/pos/webhook')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          eventType: 'ORDER_COMPLETED',
          payload: {
            orderId: 'ORD-9842',
            timestamp: new Date().toISOString(),
            customerId: 'POS-CUST-81',
            items: [{ sku: 'P9-SKU-01', name: 'Luxury Teapot', quantity: 2, price: 35.0 }],
          },
        })

      expect(res.status).toBe(201)
      expect(res.body.data.totalAmount).toBe(70.0)

      // Verify stock was decremented
      const updatedStock = (await Product.findOne({ businessId: testBusinessId, sku: 'P9-SKU-01' })).currentStock
      expect(updatedStock).toBe(initialStock - 2)
    })

    it('Ingests accounting expense bill webhook', async () => {
      const res = await request(app)
        .post('/api/integrations/accounting/webhook')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          eventType: 'BILL_PAID',
          payload: {
            invoiceId: 'XERO-BILL-441',
            vendor: 'Amazon Web Services',
            amount: 85.50,
            category: 'Software',
          },
        })

      expect(res.status).toBe(201)
      expect(res.body.data.amount).toBe(85.50)
    })

    it('GET /api/integrations/status - reports connected adapters and sync counts', async () => {
      const res = await request(app)
        .get('/api/integrations/status')
        .set('Authorization', `Bearer ${tokenAdmin}`)

      expect(res.status).toBe(200)
      expect(res.body.data.supportedAdapters.length).toBe(4)
      expect(res.body.data.metrics.totalPosOrdersSynced).toBeGreaterThan(0)
    })
  })

  // ==========================================================================
  // 8. Feature 10: Recommendation Impact Tracking & Realized ROI
  // ==========================================================================
  describe('Recommendation Impact Tracking & ROI Verification', () => {
    it('Measures post-action outcome and sets status to REALIZED', async () => {
      const res = await request(app)
        .post(`/api/recommendations/${sampleRec._id}/track-impact`)
        .set('Authorization', `Bearer ${tokenAdmin}`)

      expect(res.status).toBe(200)
      expect(res.body.data.impactTracking.status).toBe('REALIZED')
      expect(res.body.data.impactTracking.realizedImpactAmount).toBe(700)
    })

    it('GET /api/recommendations/roi/summary - aggregates realized financial impact', async () => {
      const res = await request(app)
        .get('/api/recommendations/roi/summary')
        .set('Authorization', `Bearer ${tokenAdmin}`)

      expect(res.status).toBe(200)
      expect(res.body.data.realizedCount).toBeGreaterThan(0)
      expect(res.body.data.totalRealizedImpact).toBeGreaterThan(0)
    })
  })

  // ==========================================================================
  // 9. Features 7 & 8: Advanced ML Demand Forecasting & Monitoring
  // ==========================================================================
  describe('Advanced ML Forecasting & Model Governance', () => {
    it('Generates scenario-adjusted demand forecast with promotional lift', async () => {
      const res = await request(app)
        .post('/api/ml/forecast/advanced')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          horizon_days: 14,
          promotional_lift_pct: 20,
        })

      expect(res.status).toBe(200)
      expect(res.body.data.scenario_applied.promotional_lift_pct).toBe(20)
      expect(res.body.data.forecast.adjusted_predicted_units).toBeGreaterThan(
        res.body.data.forecast.base_predicted_units
      )
    })

    it('GET /api/ml/monitoring - returns model drift scores and retraining recommendations', async () => {
      const res = await request(app)
        .get('/api/ml/monitoring')
        .set('Authorization', `Bearer ${tokenAdmin}`)

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('HEALTHY')
      expect(res.body.data.models).toHaveProperty('demand_forecasting')
      expect(res.body.data.models.demand_forecasting).toHaveProperty('drift_score')
    })
  })
})
