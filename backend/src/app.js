import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import mongoose from 'mongoose'
import { successResponse, errorResponse } from './utils/apiResponse.js'
import { errorHandler } from './middleware/errorHandler.js'

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

// Service Identification & Health Check
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'

  return successResponse(res, {
    service: 'opsmind-backend',
    status: 'healthy',
    database: {
      status: dbStatus,
      host: mongoose.connection.host || 'unconnected',
      name: mongoose.connection.name || 'opsmind',
    },
    uptime: `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development',
  }, 'OpsMind Backend Service is running')
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
