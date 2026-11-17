import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as documentService from './document.service.js'

export const createDocument = catchAsync(async (req, res) => {
  const result = await documentService.createDocument(req.businessId, req.body)
  return successResponse(res, result, 'Business document indexed successfully', 201)
})

export const listDocuments = catchAsync(async (req, res) => {
  const result = await documentService.listDocuments(req.businessId, req.query)
  return successResponse(res, result, 'Business documents retrieved successfully')
})

export const getDocument = catchAsync(async (req, res) => {
  const result = await documentService.getDocumentById(req.businessId, req.params.id)
  return successResponse(res, result, 'Document retrieved successfully')
})

export const deleteDocument = catchAsync(async (req, res) => {
  const result = await documentService.deleteDocument(req.businessId, req.params.id)
  return successResponse(res, result, 'Document deleted successfully')
})

export const queryRAG = catchAsync(async (req, res) => {
  const { query, limit } = req.body
  const result = await documentService.queryBusinessDocuments(req.businessId, query, limit)
  return successResponse(res, result, 'Relevant document excerpts retrieved')
})
