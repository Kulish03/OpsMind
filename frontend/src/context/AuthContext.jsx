import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [business, setBusiness] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('opsmind_token') || null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Verify and hydrate session on mount
  const checkAuth = useCallback(async () => {
    const savedToken = localStorage.getItem('opsmind_token')
    if (!savedToken) {
      setUser(null)
      setBusiness(null)
      setToken(null)
      setIsLoading(false)
      return
    }

    try {
      const res = await api.get('/auth/me')
      if (res && res.data) {
        setUser(res.data.user)
        setBusiness(res.data.business)
        setToken(savedToken)
      } else {
        throw new Error('Invalid session response')
      }
    } catch (err) {
      console.warn('Session verification failed, logging out:', err?.message)
      localStorage.removeItem('opsmind_token')
      setUser(null)
      setBusiness(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = async (email, password) => {
    setError(null)
    try {
      const res = await api.post('/auth/login', { email, password })
      if (res && res.data) {
        const { token: newToken, user: userData, business: businessData } = res.data
        localStorage.setItem('opsmind_token', newToken)
        setToken(newToken)
        setUser(userData)
        setBusiness(businessData)
        return { success: true }
      }
      throw new Error(res?.message || 'Login failed')
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed'
      setError(msg)
      return { success: false, message: msg }
    }
  }

  const register = async (registrationData) => {
    setError(null)
    try {
      const res = await api.post('/auth/register', registrationData)
      if (res && res.data) {
        const { token: newToken, user: userData, business: businessData } = res.data
        localStorage.setItem('opsmind_token', newToken)
        setToken(newToken)
        setUser(userData)
        setBusiness(businessData)
        return { success: true }
      }
      throw new Error(res?.message || 'Registration failed')
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed'
      setError(msg)
      return { success: false, message: msg }
    }
  }

  const logout = () => {
    localStorage.removeItem('opsmind_token')
    setToken(null)
    setUser(null)
    setBusiness(null)
    setError(null)
  }

  const value = {
    user,
    business,
    token,
    currency: business?.currency || 'GBP',
    isAuthenticated: Boolean(token && user),
    isLoading,
    error,
    login,
    register,
    logout,
    refreshProfile: checkAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
