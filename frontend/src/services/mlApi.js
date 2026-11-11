import api from './api'

export const getMLOverview = async () => {
  const res = await api.get('/ml/overview')
  return res.data
}

export const getDemandForecast = async (horizon_days = 14, sku = null) => {
  const res = await api.post('/ml/forecast', { horizon_days, sku })
  return res.data
}

export const getAnomalies = async (domain = 'expenses', limit = 50) => {
  const res = await api.post('/ml/anomalies', { domain, limit })
  return res.data
}

export const getInventoryRisk = async (limit = 100) => {
  const res = await api.post('/ml/inventory-risk', { limit })
  return res.data
}

export const getCustomerChurn = async (limit = 50) => {
  const res = await api.post('/ml/customer-churn', { limit })
  return res.data
}

export const retrainModel = async (modelName) => {
  const res = await api.post(`/ml/train/${modelName}`)
  return res.data
}
