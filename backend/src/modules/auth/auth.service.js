import jwt from 'jsonwebtoken'
import { User } from './user.model.js'
import { Business } from './business.model.js'

/**
 * Generate signed JWT for authenticated user
 */
export const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || 'supersecretjwtkey_replace_in_production'
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'

  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      businessId: user.businessId,
      role: user.role,
    },
    secret,
    { expiresIn }
  )
}

/**
 * Register a new user and create their initial business tenant
 */
export const registerUser = async ({ name, email, password, businessName, businessType, currency }) => {
  // Check if user already exists
  const existingUser = await User.findOne({ email })
  if (existingUser) {
    const error = new Error('An account with this email already exists.')
    error.statusCode = 409
    throw error
  }

  // Generate unique slugified businessId
  const sanitizedName = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 30)
  const businessId = `${sanitizedName}_${Date.now().toString().slice(-6)}`

  // 1. Create Business Profile
  const business = new Business({
    businessId,
    name: businessName,
    businessType: businessType || 'retail',
    currency: currency || 'GBP',
    contactEmail: email,
    demoDataLoaded: false,
  })
  await business.save()

  // 2. Create User Profile with 'admin' privileges for the new tenant
  const user = new User({
    businessId,
    name,
    email,
    password,
    role: 'admin',
    lastLogin: new Date(),
  })
  await user.save()

  // 3. Link owner to business
  business.ownerId = user._id
  await business.save()

  // 4. Generate Auth Token
  const token = generateToken(user)

  return {
    user: user.toJSON(),
    business: {
      businessId: business.businessId,
      name: business.name,
      businessType: business.businessType,
      currency: business.currency,
      settings: business.settings,
    },
    token,
  }
}

/**
 * Authenticate existing user credentials
 */
export const loginUser = async ({ email, password }) => {
  // Fetch user including the password field
  const user = await User.findOne({ email }).select('+password')
  if (!user) {
    const error = new Error('Invalid email or password.')
    error.statusCode = 401
    throw error
  }

  if (!user.isActive) {
    const error = new Error('This account has been deactivated. Please contact support.')
    error.statusCode = 403
    throw error
  }

  // Validate password
  const isMatch = await user.comparePassword(password)
  if (!isMatch) {
    const error = new Error('Invalid email or password.')
    error.statusCode = 401
    throw error
  }

  // Fetch business profile
  const business = await Business.findOne({ businessId: user.businessId })

  // Update last login timestamp
  user.lastLogin = new Date()
  await user.save()

  // Generate Token
  const token = generateToken(user)

  return {
    user: user.toJSON(),
    business: business
      ? {
          businessId: business.businessId,
          name: business.name,
          businessType: business.businessType,
          currency: business.currency,
          settings: business.settings,
        }
      : {
          businessId: user.businessId,
          name: 'Default Retail Business',
          businessType: 'retail',
          currency: 'GBP',
        },
    token,
  }
}
