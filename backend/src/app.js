import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import mongoose from 'mongoose'
import { successResponse, errorResponse } from './utils/apiResponse.js'
import { errorHandler } from './middleware/errorHandler.js'
import { apiLimiter, authLimiter, copilotLimiter } from './middleware/rateLimiter.js'
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
import recommendationRouter from './modules/recommendations/recommendation.routes.js'
import importRouter from './modules/business/import.routes.js'
import reportRouter from './modules/reports/report.routes.js'
import documentRouter from './modules/documents/document.routes.js'
import integrationsRouter from './modules/integrations/webhook.routes.js'

const app = express()

// Security & Parsing Middleware
app.use(helmet())

// Multi-Origin Production CORS Configuration
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or matched origins
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true)
      }
      return callback(new Error('CORS policy does not allow access from the specified Origin.'), false)
    },
    credentials: true,
  })
)

// Request Body Size Limits (1MB default to prevent memory exhaustion / DoS)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(express.text({ type: ['text/plain', 'text/csv'], limit: '5mb' }))

// Rate Limiting Guards
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/copilot/chat', copilotLimiter)
app.use('/api/', apiLimiter)

// Request Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'))
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
app.use('/api/recommendations', recommendationRouter)
app.use('/api/import', importRouter)
app.use('/api/reports', reportRouter)
app.use('/api/documents', documentRouter)
app.use('/api/integrations', integrationsRouter)

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
