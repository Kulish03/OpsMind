import dotenv from 'dotenv'
dotenv.config()

import app from './app.js'
import connectDB from './config/db.js'
import mongoose from 'mongoose'

const PORT = process.env.PORT || 5000

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB()

    // Start HTTP Server
    const server = app.listen(PORT, () => {
      console.log(`=============================================`)
      console.log(` OpsMind Backend Service running on port ${PORT}`)
      console.log(` Database: Connected to MongoDB`)
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`)
      console.log(` Health Check: http://localhost:${PORT}/api/health`)
      console.log(`=============================================`)
    })

    // Graceful Shutdown
    const handleShutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`)
      server.close(async () => {
        console.log('HTTP server closed.')
        await mongoose.connection.close()
        console.log('MongoDB connection closed.')
        process.exit(0)
      })
    }

    process.on('SIGTERM', () => handleShutdown('SIGTERM'))
    process.on('SIGINT', () => handleShutdown('SIGINT'))
  } catch (error) {
    console.error(`Failed to start server due to database error:`, error.message)
    process.exit(1)
  }
}

startServer()
