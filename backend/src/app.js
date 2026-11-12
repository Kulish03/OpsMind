import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import mongoose from 'mongoose'
import { successResponse, errorResponse } from './utils/apiResponse.js'
import { errorHandler } from './middleware/errorHandler.js'
import { checkMLServiceHealth } from './utils/mlClient.js'
import authRouter from './modules/auth/auth.routes.js'
import businessRouter from './modules/business/business.routes.js'
import productRouter from './modules/business/product.routes.js'
import saleRouter from './modules/business/sale.routes.js'
import inventoryRouter from './modules/business/inventory.routes.js'
import customerRouter from './modules/business/customer.routes.js'
import supplierRouter from './modules/business/supplier.routes.js'
import expenseRouter from './modules/business/expense.routes.js'
import analyticsRouter from './modules/analytics/analytics.routes.js'
import alertRouter from './modules/notifications/alert.routes.js'
import mlRouter from './modules/ml/ml.routes.js'
import copilotRouter from './modules/copilot/copilot.routes.js'

const app = express()

// Security & Parsing Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Request Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}

// Mount Authentication, Tenancy & Domain Routes
app.use('/api/auth', authRouter)
app.use('/api/businesses', businessRouter)
app.use('/api/products', productRouter)
app.use('/api/sales', saleRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/customers', customerRouter)
app.use('/api/suppliers', supplierRouter)
app.use('/api/expenses', expenseRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/alerts', alertRouter)
app.use('/api/ml', mlRouter)
app.use('/api/copilot', copilotRouter)

// Service Identification & Integrated System Health Check
app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  const mlServiceHealth = await checkMLServiceHealth()

  const allHealthy = dbStatus === 'connected' && mlServiceHealth.status === 'connected'

  return successResponse(res, {
    service: 'opsmind-backend',
    status: allHealthy ? 'healthy' : 'partially_degraded',
    database: {
      status: dbStatus,
      host: mongoose.connection.host || 'localhost',
      name: mongoose.connection.name || 'opsmind',
    },
    mlService: mlServiceHealth,
    uptime: `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development',
  }, allHealthy ? 'All OpsMind Core Services are operational' : 'Some services are starting or unreachable')
})

// Base Endpoint
app.get('/', (req, res) => {
  return successResponse(res, {
    project: 'OpsMind — AI-Powered Operations Copilot for SMEs',
    version: '0.1.0',
    documentation: '/docs',
  }, 'Welcome to OpsMind API')
})

// 404 Not Found Handler
app.use((req, res) => {
  return errorResponse(res, `Route not found: ${req.method} ${req.originalUrl}`, 404)
})

// Global Error Handler
app.use(errorHandler)

export default app
