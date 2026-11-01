import mongoose from 'mongoose'

/**
 * Connect to MongoDB instance using Mongoose
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/opsmind'

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    })

    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`)
    console.log(`[MongoDB] Database Name: ${conn.connection.name}`)
    return conn
  } catch (error) {
    console.error(`[MongoDB Connection Error] ${error.message}`)
    console.error(`Please verify that MongoDB is running and your MONGODB_URI is correct.`)
    throw error
  }
}

// Connection event listeners
mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected from database.')
})

mongoose.connection.on('error', (err) => {
  console.error(`[MongoDB Event Error] ${err.message}`)
})

export default connectDB
