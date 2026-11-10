import { Router } from 'express'
import * as analyticsController from './analytics.controller.js'
import { authenticate } from '../../middleware/authMiddleware.js'
import { enforceTenantScope } from '../../middleware/tenantMiddleware.js'

const router = Router()

// All Analytics routes require valid authentication and strict tenant isolation
router.use(authenticate, enforceTenantScope)

// Financial & Operational KPI Dashboards
router.get('/kpis', analyticsController.getKPIs)
router.get('/revenue-trend', analyticsController.getRevenueTrend)
router.get('/top-products', analyticsController.getTopProducts)
router.get('/category-breakdown', analyticsController.getCategoryBreakdown)
router.get('/customer-insights', analyticsController.getCustomerInsights)
router.get('/inventory-health', analyticsController.getInventoryHealth)

// Phase 4: Granular Sales Summaries, Comparison & Profitability Deep-Dives
router.get('/sales-summaries', analyticsController.getSalesSummaries)
router.get('/revenue-vs-expense', analyticsController.getRevenueVsExpenseComparison)
router.get('/date-comparison', analyticsController.getDateOverDateComparison)
router.get('/product-deep-dive', analyticsController.getProductAndCategoryDeepDive)

export default router
