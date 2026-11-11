import * as mlClient from '../../utils/mlClient.js'
import Product from '../business/product.model.js'
import Supplier from '../business/supplier.model.js'
import AppError from '../../utils/AppError.js'

export const getModelsOverview = async () => {
  try {
    return await mlClient.getMLModelsOverview()
  } catch (err) {
    throw new AppError(`ML Service unavailable: ${err.message}`, 503)
  }
}

export const getDemandForecast = async ({ horizon_days = 14, sku = null } = {}) => {
  try {
    return await mlClient.getDemandForecast({ horizon_days, sku })
  } catch (err) {
    throw new AppError(`Demand forecast failed: ${err.message}`, 503)
  }
}

export const getAnomalies = async ({ domain = 'expenses', limit = 50, records = null } = {}) => {
  try {
    return await mlClient.detectAnomalies({ domain, limit, records })
  } catch (err) {
    throw new AppError(`Anomaly detection failed: ${err.message}`, 503)
  }
}

export const getInventoryRisk = async ({ businessId, limit = 100 } = {}) => {
  try {
    // Optionally enrich with tenant's live products and suppliers from MongoDB
    const [products, suppliers] = await Promise.all([
      Product.find({ businessId, isActive: true }).lean().limit(1000),
      Supplier.find({ businessId }).lean(),
    ])

    const payload = {
      limit: Number(limit),
      products: products && products.length > 0 ? products : null,
      suppliers: suppliers && suppliers.length > 0 ? suppliers : null,
    }

    return await mlClient.getInventoryRisk(payload)
  } catch (err) {
    throw new AppError(`Inventory risk prediction failed: ${err.message}`, 503)
  }
}

export const getCustomerChurn = async ({ limit = 50 } = {}) => {
  try {
    return await mlClient.getCustomerChurn({ limit })
  } catch (err) {
    throw new AppError(`Customer churn prediction failed: ${err.message}`, 503)
  }
}

export const retrainModel = async (modelName) => {
  try {
    return await mlClient.retrainModel(modelName)
  } catch (err) {
    throw new AppError(`Model retraining failed: ${err.message}`, 503)
  }
}
