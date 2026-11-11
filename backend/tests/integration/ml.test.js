import request from 'supertest'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import app from '../../src/app.js'
import connectDB from '../../src/config/db.js'

describe('OpsMind Phase 5 ML Service Express Proxy Endpoints', () => {
  let authToken
  const testBusinessId = 'default_sme_retail'

  beforeAll(async () => {
    await connectDB()
    authToken = jwt.sign(
      {
        userId: new mongoose.Types.ObjectId(),
        businessId: testBusinessId,
        role: 'admin',
      },
      process.env.JWT_SECRET || 'supersecretjwtkey_replace_in_production',
      { expiresIn: '1h' }
    )
  })

  afterAll(async () => {
    await mongoose.connection.close()
  })

  it('GET /api/ml/overview - should return 401 if unauthenticated', async () => {
    const res = await request(app).get('/api/ml/overview')
    expect(res.status).toBe(401)
  })

  it('GET /api/health - should report ML service health status', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('mlService')
  })
})
