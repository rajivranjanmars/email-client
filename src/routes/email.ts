// Email API routes - completely domain-agnostic
// Handles sending, receiving, and managing emails for any domain

import { Hono } from 'hono';
import type { 
  SendEmailRequest, 
  FetchEmailsRequest, 
  EmailAccount 
} from '../types/email.js';
import { emailService } from '../services/email-service.js';
import { db } from '../services/database-service.js';

const emailRoutes = new Hono();

// Send email endpoint
emailRoutes.post('/:domain/email/send', async (c) => {
  try {
    const domain = c.req.param('domain');
    const emailRequest: SendEmailRequest = await c.req.json();

    // Validate required fields
    if (!emailRequest.from || !emailRequest.to || !emailRequest.subject) {
      return c.json({
        success: false,
        error: 'Missing required fields: from, to, subject'
      }, 400);
    }

    // Validate that sender belongs to this domain
    if (!emailRequest.from.endsWith(`@${domain}`)) {
      return c.json({
        success: false,
        error: `Sender must belong to domain ${domain}`
      }, 400);
    }

    // Send the email
    const result = await emailService.sendEmail(domain, emailRequest);

    return c.json(result, result.success ? 200 : 500);

  } catch (error) {
    console.error('Error in send email endpoint:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Fetch emails endpoint
emailRoutes.get('/:domain/email/inbox/:account', async (c) => {
  try {
    const domain = c.req.param('domain');
    const account = c.req.param('account');
    
    // Parse query parameters
    const query = c.req.query();
    const fetchRequest: FetchEmailsRequest = {
      folder: query.folder ?? 'INBOX',
      limit: query.limit ? parseInt(query.limit) : 50,
      offset: query.offset ? parseInt(query.offset) : 0,
      unseen: query.unseen === 'true'
    };

    // Construct full email address
    const fullEmail = `${account}@${domain}`;

    // Fetch emails
    const result = await emailService.fetchEmails(domain, fullEmail, fetchRequest);

    return c.json(result);

  } catch (error) {
    console.error('Error in fetch emails endpoint:', error);
    return c.json({
      success: false,
      emails: [],
      total: 0,
      error: 'Internal server error'
    }, 500);
  }
});

// Fetch emails from database only (simple fallback)
emailRoutes.get('/:domain/email/list', async (c) => {
  try {
    const domain = c.req.param('domain');
    const query = c.req.query();
    
    const limit = query.limit ? parseInt(query.limit) : 50;
    const offset = query.offset ? parseInt(query.offset) : 0;

    // Get emails directly from database
    const emails = await db.getEmailsByDomain(domain, limit, offset);

    return c.json({
      success: true,
      emails,
      total: emails.length
    });

  } catch (error) {
    console.error('Error in list emails endpoint:', error);
    return c.json({
      success: false,
      emails: [],
      total: 0,
      error: 'Internal server error'
    }, 500);
  }
});

// Sync emails from IMAP server
emailRoutes.post('/:domain/email/sync/:account', async (c) => {
  try {
    const domain = c.req.param('domain');
    const account = c.req.param('account');
    const fullEmail = `${account}@${domain}`;

    // Sync emails from IMAP
    const result = await emailService.syncEmailsFromIMAP(domain, fullEmail);

    // Store synced emails in database
    if (result.success && result.emails.length > 0) {
      for (const email of result.emails) {
        try {
          await db.storeEmail(email);
        } catch (storeError) {
          // Email might already exist, log warning but continue with others
          console.warn(`Email ${email.messageId} already exists or failed to store:`, storeError);
        }
      }
    }

    return c.json(result);

  } catch (error) {
    console.error('Error in sync emails endpoint:', error);
    return c.json({
      success: false,
      emails: [],
      total: 0,
      error: 'Internal server error'
    }, 500);
  }
});

// Get specific email by ID
emailRoutes.get('/:domain/email/:emailId', async (c) => {
  try {
    const domain = c.req.param('domain');
    const emailId = c.req.param('emailId');

    const email = await db.getEmailById(emailId);
    
    if (!email) {
      return c.json({
        success: false,
        error: 'Email not found'
      }, 404);
    }

    // Verify email belongs to the requested domain
    if (email.domain !== domain) {
      return c.json({
        success: false,
        error: 'Email does not belong to this domain'
      }, 403);
    }

    return c.json({
      success: true,
      email
    });

  } catch (error) {
    console.error('Error in get email endpoint:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Search emails
emailRoutes.get('/:domain/email/search', async (c) => {
  try {
    const domain = c.req.param('domain');
    const query = c.req.query();
    
    if (!query.q) {
      return c.json({
        success: false,
        error: 'Search query parameter "q" is required'
      }, 400);
    }

    const limit = query.limit ? parseInt(query.limit) : 50;
    const emails = await db.searchEmails(domain, query.q, limit);

    return c.json({
      success: true,
      emails,
      total: emails.length
    });

  } catch (error) {
    console.error('Error in search emails endpoint:', error);
    return c.json({
      success: false,
      emails: [],
      total: 0,
      error: 'Internal server error'
    }, 500);
  }
});

// Create email account
emailRoutes.post('/:domain/accounts', async (c) => {
  try {
    const domain = c.req.param('domain');
    const accountData = await c.req.json();

    // Validate required fields
    if (!accountData.username || !accountData.password) {
      return c.json({
        success: false,
        error: 'Missing required fields: username, password'
      }, 400);
    }

    // Create full email address
    const fullEmail = `${accountData.username}@${domain}`;

    // Check if account already exists
    const existingAccount = await db.getEmailAccount(fullEmail);
    if (existingAccount) {
      return c.json({
        success: false,
        error: 'Email account already exists'
      }, 409);
    }

    // Create new account
    const newAccount: Omit<EmailAccount, 'id' | 'createdAt' | 'updatedAt'> = {
      domain,
      username: accountData.username,
      password: accountData.password, // In production, this should be hashed
      fullEmail,
      quota: accountData.quota ?? null,
      enabled: accountData.enabled !== false // Default to true
    };

    const createdAccount = await db.createEmailAccount(newAccount);

    // Remove password from response
    const { password, ...accountResponse } = createdAccount;

    return c.json({
      success: true,
      account: accountResponse
    }, 201);

  } catch (error) {
    console.error('Error in create account endpoint:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// List email accounts for domain
emailRoutes.get('/:domain/accounts', async (c) => {
  try {
    const domain = c.req.param('domain');

    const accounts = await db.getAccountsByDomain(domain);
    
    // Remove passwords from response
    const accountsResponse = accounts.map(({ password, ...account }) => account);

    return c.json({
      success: true,
      accounts: accountsResponse
    });

  } catch (error) {
    console.error('Error in list accounts endpoint:', error);
    return c.json({
      success: false,
      accounts: [],
      error: 'Internal server error'
    }, 500);
  }
});

// Get email statistics for domain
emailRoutes.get('/:domain/stats', async (c) => {
  try {
    const domain = c.req.param('domain');

    const stats = await db.getEmailStats(domain);

    return c.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error in get stats endpoint:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Test email connectivity for domain
emailRoutes.get('/:domain/test-connectivity', async (c) => {
  try {
    const domain = c.req.param('domain');

    const result = await emailService.testConnectivity(domain);

    return c.json({
      success: true,
      domain,
      connectivity: result
    });

  } catch (error) {
    console.error('Error in test connectivity endpoint:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

export { emailRoutes };
