import React, { useState, useEffect, useRef } from 'react'
import {
  Bot,
  Send,
  User,
  Sparkles,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Wrench,
  Database,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react'
import {
  sendCopilotMessage,
  getCopilotHistory,
  clearCopilotHistory,
  getCopilotStatus,
} from '../../services/copilotApi'

export const CopilotChat = () => {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [expandedToolIndex, setExpandedToolIndex] = useState(null)
  const messagesEndRef = useRef(null)

  const quickPrompts = [
    { label: '📊 Revenue Performance', prompt: 'How is our revenue and sales performing this month?' },
    { label: '📦 Stockout Risks', prompt: 'Which products are at risk of stocking out?' },
    { label: '🔮 14-Day Demand Forecast', prompt: 'What is our forecasted demand for the next 14 days?' },
    { label: '⚠️ Expense Anomalies', prompt: 'Are there any unusual or anomalous expenses?' },
    { label: '👥 Churn Risk Customers', prompt: 'Which high-value customers are at risk of churning?' },
    { label: '⚖️ Revenue vs Expenses', prompt: 'Compare our revenue versus expenses.' },
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Load chat history & status on mount
  useEffect(() => {
    const initChat = async () => {
      setInitialLoading(true)
      try {
        const [histRes, statusRes] = await Promise.allSettled([
          getCopilotHistory(),
          getCopilotStatus(),
        ])

        if (histRes.status === 'fulfilled' && histRes.value?.messages) {
          setMessages(histRes.value.messages)
        }
        if (statusRes.status === 'fulfilled') {
          setStatus(statusRes.value)
        }
      } catch (err) {
        console.error('Failed to initialize Copilot chat:', err)
      } finally {
        setInitialLoading(false)
      }
    }

    initChat()
  }, [])

  const handleSend = async (textToSend = null) => {
    const text = textToSend || inputValue
    if (!text || text.trim().length === 0 || loading) return

    const userMsg = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInputValue('')
    setLoading(true)

    try {
      const data = await sendCopilotMessage(text.trim())

      const assistantMsg = {
        role: 'assistant',
        content: data.reply,
        toolCalls: data.toolCalls || [],
        supportingData: data.supportingData || null,
        isSecurityBlocked: data.isSecurityBlocked || false,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        content: `⚠️ **Connection Error:** Could not connect to the OpsMind Copilot service (${err.message}). Please verify the backend service is running.`,
        toolCalls: [],
        supportingData: null,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear your Copilot conversation history?')) return
    try {
      await clearCopilotHistory()
      setMessages([])
    } catch (err) {
      alert(`Failed to clear conversation: ${err.message}`)
    }
  }

  // Simple Markdown-style formatter for message text
  const formatContent = (content) => {
    if (!content) return ''
    const lines = content.split('\n')

    return lines.map((line, idx) => {
      // Headings
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-sm font-bold text-slate-900 mt-2 mb-1 flex items-center gap-1.5">
            {line.replace('### ', '')}
          </h3>
        )
      }
      if (line.startsWith('#### ')) {
        return (
          <h4 key={idx} className="text-xs font-bold text-slate-800 mt-1.5 mb-0.5">
            {line.replace('#### ', '')}
          </h4>
        )
      }

      // Bullet points
      if (line.startsWith('- ') || line.startsWith('• ')) {
        const raw = line.substring(2)
        return (
          <li key={idx} className="text-xs text-slate-700 ml-3 list-disc my-0.5 leading-relaxed">
            {parseBoldAndCode(raw)}
          </li>
        )
      }

      // Empty line
      if (line.trim() === '') {
        return <div key={idx} className="h-1.5" />
      }

      // Standard paragraph
      return (
        <p key={idx} className="text-xs text-slate-800 leading-relaxed my-0.5">
          {parseBoldAndCode(line)}
        </p>
      )
    })
  }

  // Parses **bold** and `code` spans
  const parseBoldAndCode = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px]">
            {part.slice(1, -1)}
          </code>
        )
      }
      return part
    })
  }

  return (
    <div className="flex flex-col h-[750px] bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">OpsMind AI Copilot</h2>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Grounded & Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Natural Language Operations Advisor • Tenant Scoped • Zero Hallucination
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              title="Clear conversation"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-rose-600 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/30">
        {initialLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              Loading verified business records...
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Ask OpsMind Anything About Your Business
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                I interpret your operational questions and execute authoritative backend calculations, inventory risk assessments, and machine learning models in real time.
              </p>
            </div>

            {/* Quick Suggestion Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2">
              {quickPrompts.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(item.prompt)}
                  className="p-2.5 rounded-xl border border-slate-200/90 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 text-left text-xs font-medium text-slate-700 transition shadow-2xs"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user'
            const isBlocked = msg.isSecurityBlocked

            return (
              <div
                key={idx}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isUser
                      ? 'bg-slate-800 text-white'
                      : isBlocked
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`flex flex-col space-y-2 max-w-[85%] ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  {/* Tool Call Evidence Banner (if assistant called a tool) */}
                  {!isUser && msg.toolCalls?.length > 0 && (
                    <div className="w-full">
                      {msg.toolCalls.map((tc, tIdx) => {
                        const isExpanded = expandedToolIndex === `${idx}-${tIdx}`
                        return (
                          <div
                            key={tIdx}
                            className="bg-slate-100/80 border border-slate-200/90 rounded-xl p-2 text-xs mb-2 transition"
                          >
                            <button
                              onClick={() =>
                                setExpandedToolIndex(isExpanded ? null : `${idx}-${tIdx}`)
                              }
                              className="w-full flex items-center justify-between font-mono text-[11px] text-slate-700 hover:text-indigo-600"
                            >
                              <span className="flex items-center gap-1.5">
                                <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                                <strong>Tool Executed:</strong> {tc.toolName}
                              </span>
                              <span className="flex items-center gap-1 text-slate-500">
                                Verified
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </span>
                            </button>

                            {/* Expandable Supporting Data */}
                            {isExpanded && msg.supportingData && (
                              <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] font-sans text-slate-600 space-y-1">
                                <p className="font-semibold text-slate-800">
                                  Supporting Records Grounding:
                                </p>
                                <pre className="bg-white p-2 rounded border border-slate-200 text-[10px] font-mono overflow-x-auto max-h-40">
                                  {JSON.stringify(msg.supportingData, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Main Bubble */}
                  <div
                    className={`p-4 rounded-2xl text-xs ${
                      isUser
                        ? 'bg-slate-900 text-white rounded-tr-none'
                        : isBlocked
                        ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-tl-none'
                        : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-none shadow-2xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      formatContent(msg.content)
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 px-1">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            )
          })
        )}

        {/* Loading / Typing indicator */}
        {loading && (
          <div className="flex gap-3 max-w-lg">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/20">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl rounded-tl-none shadow-2xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-xs text-slate-500 font-medium pl-1">
                Executing backend tools & calculating grounded metrics...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form & Quick Action Bar */}
      <div className="p-4 border-t border-slate-100 bg-white space-y-3">
        {/* Quick Suggestion Chips (when user is active) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {quickPrompts.slice(0, 4).map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(item.prompt)}
              disabled={loading}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap transition disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about revenue, low stock items, 14-day forecast, expense anomalies..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50/50 focus:bg-white"
          />
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm shadow-indigo-600/20 disabled:opacity-40 disabled:hover:bg-indigo-600 shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Verified against database ledger and ML models.
          </span>
          <span>Never invents figures.</span>
        </div>
      </div>
    </div>
  )
}

export default CopilotChat
