import { Router } from 'express'
import * as authController from './auth.controller.js'
import { validateRequest } from '../../middleware/validateRequest.js'
import { registerSchema, loginSchema } from './auth.validation.js'
import { authenticate } from '../../middleware/authMiddleware.js'

const router = Router()

// Public Auth Endpoints
router.post('/register', validateRequest(registerSchema), authController.register)
router.post('/login', validateRequest(loginSchema), authController.login)

// Protected Identity & Tenant Profile Endpoint
router.get('/me', authenticate, authController.getProfile)

export default router
