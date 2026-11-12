import * as copilotService from './copilot.service.js'
import { successResponse } from '../../utils/apiResponse.js'
import { catchAsync } from '../../utils/catchAsync.js'

export const chatWithCopilot = catchAsync(async (req, res) => {
  const { message, conversationId } = req.body

  const result = await copilotService.processUserMessage({
    businessId: req.businessId,
    userId: req.user._id,
    message,
    conversationId,
  })

  return successResponse(res, result, 'Copilot response generated successfully')
})

export const getConversationHistory = catchAsync(async (req, res) => {
  const result = await copilotService.getConversationHistory({
    businessId: req.businessId,
    userId: req.user._id,
  })

  return successResponse(res, result, 'Conversation history retrieved successfully')
})

export const clearConversation = catchAsync(async (req, res) => {
  const result = await copilotService.clearConversationHistory({
    businessId: req.businessId,
    userId: req.user._id,
  })

  return successResponse(res, result, 'Conversation history cleared')
})

export const getCopilotStatus = catchAsync(async (req, res) => {
  return successResponse(
    res,
    {
      status: 'operational',
      modelMode: process.env.OPENAI_API_KEY ? 'cloud_llm_enabled' : 'deterministic_semantic_engine',
      tenantIsolation: 'enforced_server_side',
      approvedToolsCount: 11,
      ragCapabilities: 'structured_tool_grounding',
    },
    'AI Copilot service is active'
  )
})
