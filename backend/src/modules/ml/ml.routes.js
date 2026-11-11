import { Router } from 'express'
import * as mlController from './ml.controller.js'
import { authenticate } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'

const router = Router()

// All ML routes require valid authentication and tenant isolation
router.use(authenticate, enforceTenantScope)

router.get('/overview', mlController.getModelsOverview)
router.post('/forecast', mlController.getDemandForecast)
router.get('/forecast', mlController.getDemandForecast)
router.post('/anomalies', mlController.getAnomalies)
router.get('/anomalies', mlController.getAnomalies)
router.post('/inventory-risk', mlController.getInventoryRisk)
router.get('/inventory-risk', mlController.getInventoryRisk)
router.post('/customer-churn', mlController.getCustomerChurn)
router.get('/customer-churn', mlController.getCustomerChurn)
router.post('/train/:modelName', mlController.retrainModel)

export default router
