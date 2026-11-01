/**
 * HTTP Client to communicate with the Python FastAPI ML Service
 */
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'

export const checkMLServiceHealth = async () => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return { status: 'degraded', statusCode: response.status }
    }

    const data = await response.json()
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
