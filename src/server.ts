import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { domainsRoute } from './routes/domains.js'
import { emailRoutes } from './routes/email.js'
import { db } from './services/database-service.js'
import { emailService } from './services/email-service.js'

// Types for our email server
export interface Domain {
  domain: string
  smtp: {
    host: string
    port: number
    secure: boolean
  }
  imap: {
    host: string
    port: number
    secure: boolean
  }
  accounts: EmailAccount[]
  created: string
  status: 'active' | 'inactive'
}

export interface EmailAccount {
  email: string
  name: string
  password: string // Will be encrypted
  created: string
}

// Create Hono app with strict typing
const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: '*', // In production, specify allowed origins
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'multi-domain-email-server'
  })
})

// API routes
app.route('/api/domains', domainsRoute)
app.route('/api', emailRoutes) // Email routes: /api/:domain/email/*

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'Multi-Domain Email Server API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      domains: '/api/domains',
      email: '/api/:domain/email/*',
      docs: 'See README.md for full API documentation'
    }
  })
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Endpoint not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ 
    error: 'Internal server error',
    message: err.message 
  }, 500)
})

// Initialize database connection
async function initializeServer() {
  try {
    console.log('🔄 Initializing database connection...')
    await db.connect()
    
    console.log('✅ Server initialized successfully')
  } catch (error) {
    console.warn('⚠️ Server initialization warning:', error)
    console.log('📝 Continuing in development mode...')
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Shutting down gracefully...')
  try {
    await emailService.cleanup()
    await db.disconnect()
    console.log('✅ Shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
})

// Start server
const port = process.env.PORT ?? 3000
console.log(`🚀 Multi-Domain Email Server starting on port ${port}`)
console.log(`📧 Ready to handle unlimited domains with zero hardcoded values`)

// Initialize and start
if (import.meta.main) {
  await initializeServer()
  console.log(`🌐 Server running at http://localhost:${port}`)
}

// Export for Bun
export default {
  port: Number(port),
  fetch: app.fetch,
}
