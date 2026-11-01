import dotenv from 'dotenv'
dotenv.config()

import app from './app.js'

const PORT = process.env.PORT || 5000

const server = app.listen(PORT, () => {
  console.log(`=============================================`)
  console.log(` OpsMind Backend Service running on port ${PORT}`)
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(` Health Check: http://localhost:${PORT}/api/health`)
  console.log(`=============================================`)
})

// Graceful Shutdown
const handleShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`)
  server.close(() => {
    console.log('HTTP server closed.')
    process.exit(0)
  })
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('SIGINT', () => handleShutdown('SIGINT'))
