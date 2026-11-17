import BusinessDocument from './businessDocument.model.js'
import AppError from '../../utils/AppError.js'

/**
 * Split text into semantic chunks and extract key search tokens
 */
const chunkText = (text, chunkSize = 250) => {
  const words = text.split(/\s+/)
  const chunks = []
  let currentWords = []
  let chunkIdx = 0

  for (let i = 0; i < words.length; i++) {
    currentWords.push(words[i])
    if (currentWords.length >= chunkSize || i === words.length - 1) {
      const chunkText = currentWords.join(' ')
      // Simple stopword filtered keywords
      const keywords = Array.from(
        new Set(
          chunkText
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter((w) => w.length > 3)
        )
      ).slice(0, 20)

      chunks.push({
        chunkId: `chk-${Date.now()}-${chunkIdx++}`,
        text: chunkText,
        keywords,
      })
      currentWords = []
    }
  }

  return chunks
}

export const createDocument = async (businessId, payload) => {
  if (!payload.title || !payload.content) {
    throw new AppError('Document title and text content are required', 400)
  }

  const chunks = chunkText(payload.content)

  const doc = await BusinessDocument.create({
    businessId,
    title: payload.title,
    category: payload.category || 'POLICY',
    content: payload.content,
    chunks,
    metadata: payload.metadata || {},
  })

  return doc
}

export const listDocuments = async (businessId, query = {}) => {
  const filter = { businessId }
  if (query.category) filter.category = query.category

  const docs = await BusinessDocument.find(filter)
    .select('title category metadata createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .lean()

  return docs
}

export const getDocumentById = async (businessId, id) => {
  const doc = await BusinessDocument.findOne({ _id: id, businessId }).lean()
  if (!doc) throw new AppError('Business document not found', 404)
  return doc
}

export const deleteDocument = async (businessId, id) => {
  const doc = await BusinessDocument.findOneAndDelete({ _id: id, businessId })
  if (!doc) throw new AppError('Business document not found', 404)
  return doc
}

/**
 * Retrieval-Augmented Generation (RAG) Document Query
 * Retrieves relevant policy/contract excerpts grounded on user query terms.
 */
export const queryBusinessDocuments = async (businessId, queryText, limit = 3) => {
  if (!queryText || typeof queryText !== 'string') return []

  const tokens = queryText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)

  const docs = await BusinessDocument.find({ businessId }).lean()

  const scoredChunks = []

  for (const doc of docs) {
    for (const chunk of doc.chunks) {
      let score = 0
      const lowerChunk = chunk.text.toLowerCase()

      tokens.forEach((t) => {
        if (chunk.keywords.includes(t)) score += 3
        if (lowerChunk.includes(t)) score += 1
      })

      if (score > 0) {
        scoredChunks.push({
          documentTitle: doc.title,
          category: doc.category,
          text: chunk.text,
          excerptText: chunk.text,
          relevanceScore: score,
        })
      }
    }
  }

  scoredChunks.sort((a, b) => b.relevanceScore - a.relevanceScore)
  return scoredChunks.slice(0, limit)
}
