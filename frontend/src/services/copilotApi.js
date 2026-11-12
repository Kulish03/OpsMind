import api from './api'

export const sendCopilotMessage = async (message, conversationId = null) => {
  const res = await api.post('/copilot/chat', { message, conversationId })
  return res.data
}

export const getCopilotHistory = async () => {
  const res = await api.get('/copilot/history')
  return res.data
}

export const clearCopilotHistory = async () => {
  const res = await api.post('/copilot/clear')
  return res.data
}

export const getCopilotStatus = async () => {
  const res = await api.get('/copilot/status')
  return res.data
}
