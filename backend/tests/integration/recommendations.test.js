import request from 'supertest'
import mongoose from 'mongoose'
import app from '../../src/app.js'
import connectDB from '../../src/config/db.js'
import { User, Business } from '../../src/modules/auth/index.js'
import { generateToken } from '../../src/modules/auth/auth.service.js'
import Recommendation from '../../src/modules/recommendations/recommendation.model.js'
import RecommendationAudit from '../../src/modules/recommendations/recommendationAudit.model.js'
import Product from '../../src/modules/business/product.model.js'
import InventoryMovement from '../../src/modules/business/inventoryMovement.model.js'

describe('OpsMind Phase 7 Recommendations & Human Approval Integration Suite', () => {
  let authToken
  let testUser
  const testBusinessId = 'default_sme_retail'
  let sampleRecId
  let sampleProductSku = 'TEST-SKU-REC-101'

  beforeAll(async () => {
    await connectDB()

    // Ensure business tenant exists
    await Business.findOneAndUpdate(
      { businessId: testBusinessId },
      {
        businessId: testBusinessId,
        name: 'OpsMind Retail SME',
        businessType: 'retail',
        currency: 'GBP',
      },
      { upsert: true, new: true }
    )

    // Ensure test user exists
    testUser = await User.findOne({ businessId: testBusinessId, role: 'admin' })
    if (!testUser) {
      testUser = await User.create({
        name: 'Recommendation Test Admin',
        email: `rec_admin_${Date.now()}@opsmind.io`,
        password: 'Password123!',
        role: 'admin',
        businessId: testBusinessId,
      })
    }

    authToken = generateToken(testUser)

    // Ensure a test product exists for consequential PO execution testing
    await Product.findOneAndUpdate(
      { businessId: testBusinessId, sku: sampleProductSku },
      {
        businessId: testBusinessId,
        sku: sampleProductSku,
        name: 'OpsMind Test Widget',
        costPrice: 5.0,
        sellingPrice: 15.0,
        currentStock: 10,
        reorderThreshold: 25,
      },
      { upsert: true, new: true }
    )
  })

  afterAll(async () => {
    // Clean up test records
    await Recommendation.deleteMany({ businessId: testBusinessId, 'action.targetEntity.sku': sampleProductSku })
    await RecommendationAudit.deleteMany({ businessId: testBusinessId })
    await Product.deleteOne({ businessId: testBusinessId, sku: sampleProductSku })
    await InventoryMovement.deleteMany({ businessId: testBusinessId, productSku: sampleProductSku })
    await mongoose.connection.close()
  })

  describe('Authentication & Tenancy Guardrails', () => {
    it('GET /api/recommendations - should reject unauthenticated requests with HTTP 401', async () => {
      const res = await request(app).get('/api/recommendations')
      expect(res.status).toBe(401)
    })

    it('POST /api/recommendations/generate - should require authentication', async () => {
      const res = await request(app).post('/api/recommendations/generate')
      expect(res.status).toBe(401)
    })
  })

  describe('Recommendation Generation & Retrieval', () => {
    it('POST /api/recommendations/generate - should generate recommendations from rules & ML', async () => {
      const res = await request(app)
        .post('/api/recommendations/generate')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('GET /api/recommendations - should list recommendations with pagination & summary', async () => {
      const res = await request(app)
        .get('/api/recommendations?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty('items')
      expect(res.body.data).toHaveProperty('pagination')
      expect(res.body.data).toHaveProperty('summary')
      expect(Array.isArray(res.body.data.items)).toBe(true)
    })

    it('GET /api/recommendations/summary - should return aggregated metric counts', async () => {
      const res = await request(app)
        .get('/api/recommendations/summary')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty('pendingReviewCount')
      expect(res.body.data).toHaveProperty('totalEstimatedFinancialImpact')
      expect(typeof res.body.data.totalEstimatedFinancialImpact).toBe('number')
    })
  })

  describe('Human Review Workflow (Approve, Reject, Dismiss)', () => {
    let testRec

    beforeEach(async () => {
      // Create a test recommendation
      testRec = await Recommendation.create({
        businessId: testBusinessId,
        title: 'Low Stock Restock Test Recommendation',
        type: 'INVENTORY_REORDER',
        category: 'Inventory',
        severity: 'HIGH',
        urgency: 'IMMEDIATE',
        status: 'PENDING_REVIEW',
        reason: 'Stock is below safety margin.',
        evidence: {
          metrics: { currentStock: 10, reorderThreshold: 25 },
          generatedBy: 'BUSINESS_RULES',
        },
        estimatedImpact: {
          metric: 'Protected Revenue',
          amount: 250,
          currency: 'GBP',
          explanation: 'Protects £250 in sales.',
        },
        action: {
          actionType: 'PURCHASE_ORDER',
          targetEntity: {
            entityType: 'product',
            entityId: sampleProductSku,
            sku: sampleProductSku,
            name: 'OpsMind Test Widget',
          },
          suggestedPayload: {
            sku: sampleProductSku,
            orderQty: 40,
            unitCost: 5.0,
            supplierName: 'Official Supplier Ltd',
          },
          isConsequential: true,
          requiresConfirmation: true,
        },
      })
      sampleRecId = testRec._id.toString()
    })

    afterEach(async () => {
      if (testRec) {
        await Recommendation.findByIdAndDelete(testRec._id)
      }
    })

    it('PATCH /api/recommendations/:id/review - should reject invalid review status', async () => {
      const res = await request(app)
        .patch(`/api/recommendations/${sampleRecId}/review`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'INVALID_STATUS' })

      expect(res.status).toBe(400)
    })

    it('PATCH /api/recommendations/:id/review - should approve recommendation and record decision', async () => {
      const res = await request(app)
        .patch(`/api/recommendations/${sampleRecId}/review`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'APPROVED',
          notes: 'Approved after verifying warehouse space.',
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe('APPROVED')
      expect(res.body.data.decision.decisionNotes).toBe('Approved after verifying warehouse space.')
      expect(res.body.data.decision.decidedByName).toBe(testUser.name)
    })

    it('PATCH /api/recommendations/:id/review - should dismiss recommendation', async () => {
      const res = await request(app)
        .patch(`/api/recommendations/${sampleRecId}/review`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'DISMISSED',
          notes: 'Dismissed because duplicate shipment is in transit.',
        })

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('DISMISSED')
    })
  })

  describe('Consequential Operations & Explicit Human Confirmation', () => {
    let actionableRec

    beforeEach(async () => {
      actionableRec = await Recommendation.create({
        businessId: testBusinessId,
        title: 'Restock PO for Widget',
        type: 'INVENTORY_REORDER',
        category: 'Inventory',
        severity: 'CRITICAL',
        urgency: 'IMMEDIATE',
        status: 'PENDING_REVIEW',
        reason: 'Out of stock risk.',
        action: {
          actionType: 'PURCHASE_ORDER',
          targetEntity: {
            entityType: 'product',
            entityId: sampleProductSku,
            sku: sampleProductSku,
            name: 'OpsMind Test Widget',
          },
          suggestedPayload: {
            sku: sampleProductSku,
            orderQty: 50,
            unitCost: 5.0,
            supplierName: 'Fast Distro UK',
          },
          isConsequential: true,
          requiresConfirmation: true,
        },
      })
    })

    afterEach(async () => {
      if (actionableRec) {
        await Recommendation.findByIdAndDelete(actionableRec._id)
      }
    })

    it('POST /api/recommendations/:id/execute - should reject execution when confirmed !== true', async () => {
      const res = await request(app)
        .post(`/api/recommendations/${actionableRec._id}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirmed: false })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('Human confirmation is strictly required')
    })

    it('POST /api/recommendations/:id/execute - should execute consequential restock order when explicitly confirmed', async () => {
      const initialProduct = await Product.findOne({ businessId: testBusinessId, sku: sampleProductSku })
      const initialStock = initialProduct.currentStock

      const res = await request(app)
        .post(`/api/recommendations/${actionableRec._id}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          confirmed: true,
          executionPayload: {
            sku: sampleProductSku,
            orderQty: 50,
            unitCost: 5.0,
            supplierName: 'Fast Distro UK',
          },
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.recommendation.status).toBe('APPLIED')
      expect(res.body.data.executionResult.action).toBe('PURCHASE_ORDER_EXECUTED')
      expect(res.body.data.executionResult.unitsRestocked).toBe(50)
      expect(res.body.data.executionResult.totalOrderCost).toBe(250)

      // Verify product stock was updated
      const updatedProduct = await Product.findOne({ businessId: testBusinessId, sku: sampleProductSku })
      expect(updatedProduct.currentStock).toBe(initialStock + 50)

      // Verify audit movement was recorded
      const movement = await InventoryMovement.findOne({
        businessId: testBusinessId,
        productSku: sampleProductSku,
        movementType: 'INBOUND_PURCHASE',
      }).sort({ timestamp: -1 })
      expect(movement).toBeTruthy()
      expect(movement.quantity).toBe(50)
    })

    it('POST /api/recommendations/:id/execute - should prevent duplicate execution of already applied recommendation', async () => {
      // First execution
      await request(app)
        .post(`/api/recommendations/${actionableRec._id}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirmed: true })

      // Second execution attempt
      const res = await request(app)
        .post(`/api/recommendations/${actionableRec._id}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirmed: true })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('already been executed')
    })
  })

  describe('Immutable Audit Trail & Logging', () => {
    it('GET /api/recommendations/audit - should retrieve immutable audit logs for tenant', async () => {
      const res = await request(app)
        .get('/api/recommendations/audit?limit=20')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      if (res.body.data.length > 0) {
        const first = res.body.data[0]
        expect(first).toHaveProperty('action')
        expect(first).toHaveProperty('userName')
        expect(first).toHaveProperty('timestamp')
      }
    })
  })

  describe('AI Copilot Tool Grounding for Recommendations', () => {
    it('POST /api/copilot/chat - should ground recommendation queries and return formatted evidence', async () => {
      const res = await request(app)
        .post('/api/copilot/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'What recommendations require my pending review and approval?' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.reply).toBeTruthy()
      expect(res.body.data.toolCalls).toHaveLength(1)
      expect(res.body.data.toolCalls[0].toolName).toBe('get_recommendations')
    })

    it('POST /api/copilot/chat - should return audit trail history when asked about past decisions', async () => {
      const res = await request(app)
        .post('/api/copilot/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Show me the recent decision audit log history and who approved them.' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.reply).toBeTruthy()
      expect(res.body.data.toolCalls).toHaveLength(1)
      expect(res.body.data.toolCalls[0].toolName).toBe('get_recommendation_audit_log')
    })
  })
})
