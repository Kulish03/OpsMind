import CopilotConversation from './copilotConversation.model.js'
import { TOOL_HANDLERS, TOOL_DEFINITIONS } from './copilot.tools.js'
import {
  checkPromptInjection,
  determineSemanticIntent,
  formatEvidenceBasedResponse,
} from './copilot.llm.js'
import AppError from '../../utils/AppError.js'

export const processUserMessage = async ({ businessId, userId, message, conversationId = null }) => {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new AppError('Message text is required', 400)
  }

  const cleanMessage = message.trim()

  // 1. Prompt Injection & Security Guardrail
  if (checkPromptInjection(cleanMessage)) {
    return {
      reply:
        "🛡️ **Security Notice:** Your query contained an unauthorized instruction, prompt override, or system bypass attempt. OpsMind AI Copilot operates strictly within tenant-scoped operational boundaries and will not execute instructions attempting to reveal internals, system prompts, or access other tenants' data.",
      toolCalls: [],
      supportingData: null,
      isSecurityBlocked: true,
    }
  }

  // 2. Retrieve or Initialize Conversation Session
  let conversation
  if (conversationId) {
    conversation = await CopilotConversation.findOne({
      _id: conversationId,
      businessId,
      userId,
    })
  }

  if (!conversation) {
    conversation = await CopilotConversation.findOne({
      businessId,
      userId,
      isActive: true,
    }).sort({ updatedAt: -1 })
  }

  if (!conversation) {
    conversation = new CopilotConversation({
      businessId,
      userId,
      title: cleanMessage.substring(0, 40) + '...',
      messages: [],
    })
  }

  // 3. Interpret Intent & Select Approved Backend Tool
  const intent = determineSemanticIntent(cleanMessage)

  let toolResult = null
  let toolCalls = []
  let supportingData = null
  let replyText = ''

  if (!intent) {
    // Ambiguous or General Query handling
    replyText = `I understand you have an operational business inquiry, but I need a little more context to retrieve verified data for you.

You can ask me about:
- **Sales & Revenue:** *"How is our revenue performing this month?"* or *"What is our average order value?"*
- **Best Products:** *"Which products generate the highest revenue?"*
- **Inventory & Stock:** *"Are there any products at risk of stocking out?"*
- **Operating Expenses:** *"Give me a breakdown of our operating expenses."*
- **Profitability:** *"Compare our revenue versus expenses."*
- **Machine Learning Forecast:** *"What is our forecasted demand for the next 14 days?"*
- **Anomalies:** *"Have any unusual expenses or sales transactions occurred?"*
- **Customer Churn:** *"Which high-value customers are at risk of churning?"*

Please specify what area you would like to analyze.`
  } else {
    const handler = TOOL_HANDLERS[intent.toolName]
    if (!handler) {
      throw new AppError(`Selected tool '${intent.toolName}' is not registered.`, 500)
    }

    try {
      // Execute backend tool deterministically with server-injected businessId
      toolResult = await handler(businessId, intent.args)

      toolCalls.push({
        toolName: intent.toolName,
        args: intent.args,
        resultSummary: `Executed ${intent.toolName} successfully`,
        recordCount: Array.isArray(toolResult) ? toolResult.length : 1,
        executedAt: new Date(),
      })

      // Extract supporting records for UI inspection
      supportingData = {
        toolName: intent.toolName,
        timePeriod: toolResult.timePeriod || 'Historical period',
        metrics: toolResult.metrics || toolResult.summary || null,
        records:
          toolResult.topSellingProducts ||
          toolResult.flaggedObservations ||
          toolResult.flaggedLowStockItems ||
          toolResult.actionRequiredItems ||
          toolResult.criticalRiskCustomers ||
          toolResult.recentTransactions ||
          toolResult.alerts ||
          [],
      }

      // Generate evidence-grounded response
      replyText = formatEvidenceBasedResponse(intent.toolName, toolResult, cleanMessage)
    } catch (toolError) {
      console.error(`[Copilot Tool Error: ${intent.toolName}]:`, toolError)
      replyText = `⚠️ I encountered an error while retrieving verified records for **${intent.toolName.replace(/_/g, ' ')}**: ${toolError.message}. Please verify that your business records are accessible and try again.`
    }
  }

  // 4. Save to Persistent Conversation History
  conversation.messages.push({
    role: 'user',
    content: cleanMessage,
    timestamp: new Date(),
  })

  conversation.messages.push({
    role: 'assistant',
    content: replyText,
    toolCalls,
    supportingData,
    timestamp: new Date(),
  })

  await conversation.save()

  return {
    conversationId: conversation._id,
    reply: replyText,
    toolCalls,
    supportingData,
  }
}

export const getConversationHistory = async ({ businessId, userId }) => {
  const conversation = await CopilotConversation.findOne({
    businessId,
    userId,
    isActive: true,
  }).sort({ updatedAt: -1 })

  if (!conversation) {
    return {
      conversationId: null,
      messages: [],
    }
  }

  return {
    conversationId: conversation._id,
    title: conversation.title,
    messages: conversation.messages,
  }
}

export const clearConversationHistory = async ({ businessId, userId }) => {
  await CopilotConversation.updateMany(
    { businessId, userId, isActive: true },
    { $set: { isActive: false } }
  )

  return { success: true, message: 'Conversation history cleared successfully' }
}
