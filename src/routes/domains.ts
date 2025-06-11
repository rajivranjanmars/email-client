import { Hono } from 'hono'
import { DomainService } from '../services/domain-service.js'
import type { Domain } from '../server'

export const domainsRoute = new Hono()

const domainService = new DomainService()

// GET /api/domains - List all domains
domainsRoute.get('/', async (c) => {
  try {
    const domains = await domainService.getAllDomains()
    return c.json({
      success: true,
      count: domains.length,
      domains
    })
  } catch (error) {
    console.error('Error fetching domains:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch domains' 
    }, 500)
  }
})

// POST /api/domains - Create new domain
domainsRoute.post('/', async (c) => {
  try {
    const body = await c.req.json()
    
    // Basic validation
    if (!body.domain || !body.smtp || !body.imap) {
      return c.json({
        success: false,
        error: 'Missing required fields: domain, smtp, imap'
      }, 400)
    }

    const newDomain: Partial<Domain> = {
      domain: body.domain,
      smtp: body.smtp,
      imap: body.imap,
      accounts: [],
      status: 'active'
    }

    const created = await domainService.createDomain(newDomain as Domain)
    
    return c.json({
      success: true,
      message: `Domain ${body.domain} created successfully`,
      domain: created
    }, 201)
  } catch (error) {
    console.error('Error creating domain:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create domain'
    }, 500)
  }
})

// GET /api/domains/:domain - Get specific domain
domainsRoute.get('/:domain', async (c) => {
  try {
    const domainName = c.req.param('domain')
    const domain = await domainService.getDomain(domainName)
    
    if (!domain) {
      return c.json({
        success: false,
        error: `Domain ${domainName} not found`
      }, 404)
    }

    return c.json({
      success: true,
      domain
    })
  } catch (error) {
    console.error('Error fetching domain:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch domain'
    }, 500)
  }
})

// DELETE /api/domains/:domain - Remove domain
domainsRoute.delete('/:domain', async (c) => {
  try {
    const domainName = c.req.param('domain')
    const deleted = await domainService.deleteDomain(domainName)
    
    if (!deleted) {
      return c.json({
        success: false,
        error: `Domain ${domainName} not found`
      }, 404)
    }

    return c.json({
      success: true,
      message: `Domain ${domainName} deleted successfully`
    })
  } catch (error) {
    console.error('Error deleting domain:', error)
    return c.json({
      success: false,
      error: 'Failed to delete domain'
    }, 500)
  }
})
