import api from './api'

export const getRecommendations = async (params = {}) => {
  const res = await api.get('/recommendations', { params })
  return res.data
}

export const getRecommendationSummary = async () => {
  const res = await api.get('/recommendations/summary')
  return res.data
}

export const generateRecommendations = async () => {
  const res = await api.post('/recommendations/generate')
  return res.data
}

export const reviewRecommendation = async (id, { status, notes }) => {
  const res = await api.patch(`/recommendations/${id}/review`, { status, notes })
  return res.data
}

export const executeRecommendationAction = async (id, { confirmed, executionPayload }) => {
  const res = await api.post(`/recommendations/${id}/execute`, { confirmed, executionPayload })
  return res.data
}

export const getRecommendationAuditLogs = async (params = {}) => {
  const res = await api.get('/recommendations/audit', { params })
  return res.data
}
