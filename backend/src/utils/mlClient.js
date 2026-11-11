/**
 * HTTP Client to communicate with the Python FastAPI ML Service
 */
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'

const makeRequest = async (endpoint, method = 'GET', body = null, timeoutMs = 8000) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    }
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${ML_SERVICE_URL}${endpoint}`, options)
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(`ML Service responded with status ${response.status}: ${errBody}`)
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export const checkMLServiceHealth = async () => {
  try {
    const data = await makeRequest('/health', 'GET', null, 2500)
    return {
      status: 'connected',
      version: data.version,
      modelsLoaded: data.models_loaded,
    }
  } catch (error) {
    return {
      status: 'disconnected',
      error: error.message,
    }
  }
}

export const getMLServiceStatus = async () => {
  return await makeRequest('/api/v1/ml/status', 'GET')
}

export const getMLModelsOverview = async () => {
  return await makeRequest('/api/v1/ml/overview', 'GET')
}

export const getDemandForecast = async ({ horizon_days = 14, sku = null } = {}) => {
  return await makeRequest('/api/v1/ml/forecast', 'POST', {
    horizon_days: Number(horizon_days),
    sku: sku || undefined,
  })
}

export const detectAnomalies = async ({ domain = 'expenses', limit = 50, records = null } = {}) => {
  return await makeRequest('/api/v1/ml/anomalies', 'POST', {
    domain,
    limit: Number(limit),
    records: records || undefined,
  })
}

export const getInventoryRisk = async ({ limit = 100, products = null, suppliers = null } = {}) => {
  return await makeRequest('/api/v1/ml/inventory-risk', 'POST', {
    limit: Number(limit),
    products: products || undefined,
    suppliers: suppliers || undefined,
  })
}

export const getCustomerChurn = async ({ limit = 50 } = {}) => {
  return await makeRequest('/api/v1/ml/customer-churn', 'POST', {
    limit: Number(limit),
  })
}

export const retrainModel = async (modelName) => {
  return await makeRequest(`/api/v1/ml/train/${modelName}`, 'POST')
}
