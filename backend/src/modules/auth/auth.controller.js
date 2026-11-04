import { catchAsync } from '../../utils/catchAsync.js'
import { successResponse } from '../../utils/apiResponse.js'
import * as authService from './auth.service.js'
import { Business } from './business.model.js'

export const register = catchAsync(async (req, res) => {
  const result = await authService.registerUser(req.body)
  return successResponse(res, result, 'User registered successfully', 201)
})

export const login = catchAsync(async (req, res) => {
  const result = await authService.loginUser(req.body)
  return successResponse(res, result, 'Login successful', 200)
})

export const getProfile = catchAsync(async (req, res) => {
  const business = await Business.findOne({ businessId: req.user.businessId })

  return successResponse(
    res,
    {
      user: req.user,
      business: business || {
        businessId: req.user.businessId,
        name: 'Default Business',
      },
    },
    'Profile retrieved successfully',
    200
  )
})
