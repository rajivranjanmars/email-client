// Database service for PostgreSQL operations
// Completely domain-agnostic with parameterized queries

import { Client } from 'pg';
import type { EmailMessage, EmailAccount } from '../types/email.js';

export class DatabaseService {
  private client: Client | null = null;
  public isConnected = false;

  async connect(): Promise<void> {
    try {
      this.client = new Client({
        host: process.env.POSTGRES_HOST ?? 'postgres',
        port: parseInt(process.env.POSTGRES_PORT ?? '5432'),
        database: process.env.POSTGRES_DB ?? 'emaildb',
        user: process.env.POSTGRES_USER ?? 'emailuser',
        password: process.env.POSTGRES_PASSWORD ?? 'emailpass',
      });

      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Connected to PostgreSQL database');
    } catch (error) {
      console.warn('⚠️ Database connection failed (running without DB):', error);
      this.isConnected = false;
      // Don't throw error - allow server to run without DB for development
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.end();
      this.isConnected = false;
      console.log('✅ Database disconnected');
    }
  }

  public async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected || !this.client) {
      console.warn('⚠️ Database not connected - operation skipped');
      return { rows: [] }; // Return empty result for development
    }
    return await this.client.query(text, params);
  }

  // Domain Management
  async createDomain(domain: string): Promise<void> {
    const query = `
      INSERT INTO domains (domain_name, smtp_host, smtp_port, imap_host, imap_port, status) 
      VALUES ($1, 'postfix', 25, 'dovecot', 993, 'active')
      ON CONFLICT (domain_name) DO NOTHING
    `;
    await this.query(query, [domain]);
  }

  async getDomain(domain: string): Promise<any> {
    const query = 'SELECT * FROM domains WHERE domain_name = $1';
    const result = await this.query(query, [domain]);
    return result.rows[0];
  }

  async listDomains(): Promise<any[]> {
    const query = 'SELECT * FROM domains ORDER BY created_at DESC';
    const result = await this.query(query);
    return result.rows;
  }

  async deleteDomain(domain: string): Promise<void> {
    const query = 'DELETE FROM domains WHERE domain_name = $1';
    await this.query(query, [domain]);
  }

  // Email Account Management
  async createEmailAccount(account: Omit<EmailAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailAccount> {
    // First get the domain_id for the domain
    const domainQuery = 'SELECT id FROM domains WHERE domain_name = $1';
    const domainResult = await this.query(domainQuery, [account.domain]);
    
    if (domainResult.rows.length === 0) {
      throw new Error(`Domain ${account.domain} not found`);
    }
    
    const domainId = domainResult.rows[0].id;
    
    const query = `
      INSERT INTO email_accounts (domain_id, email_address, display_name, password_hash, quota_mb, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      domainId,
      account.fullEmail,
      account.username, // Using username as display name for now
      account.password,
      account.quota ? Math.ceil(account.quota / (1024 * 1024)) : null, // Convert bytes to MB
      account.enabled
    ];
    const result = await this.query(query, values);
    
    // Convert the result back to the expected format
    const dbAccount = result.rows[0];
    return {
      id: dbAccount.id,
      domain: account.domain,
      username: account.username,
      password: dbAccount.password_hash,
      fullEmail: dbAccount.email_address,
      quota: dbAccount.quota_mb ? dbAccount.quota_mb * 1024 * 1024 : undefined,
      enabled: dbAccount.is_active,
      createdAt: dbAccount.created_at,
      updatedAt: dbAccount.updated_at
    };
  }

  async getEmailAccount(fullEmail: string): Promise<EmailAccount | null> {
    const query = `
      SELECT ea.*, d.domain_name 
      FROM email_accounts ea 
      JOIN domains d ON ea.domain_id = d.id 
      WHERE ea.email_address = $1 AND ea.is_active = true
    `;
    const result = await this.query(query, [fullEmail]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const dbAccount = result.rows[0];
    const emailParts = fullEmail.split('@');
    const username = emailParts[0];
    
    if (!username) {
      throw new Error(`Invalid email format: ${fullEmail}`);
    }
    
    return {
      id: dbAccount.id,
      domain: dbAccount.domain_name,
      username,
      password: dbAccount.password_hash,
      fullEmail: dbAccount.email_address,
      quota: dbAccount.quota_mb ? dbAccount.quota_mb * 1024 * 1024 : undefined,
      enabled: dbAccount.is_active,
      createdAt: dbAccount.created_at,
      updatedAt: dbAccount.updated_at
    };
  }

  async getAccountsByDomain(domain: string): Promise<EmailAccount[]> {
    const query = `
      SELECT ea.*, d.domain_name 
      FROM email_accounts ea 
      JOIN domains d ON ea.domain_id = d.id 
      WHERE d.domain_name = $1 
      ORDER BY ea.created_at DESC
    `;
    const result = await this.query(query, [domain]);
    
    return result.rows.map((dbAccount: any) => {
      const emailParts = dbAccount.email_address.split('@');
      const username = emailParts[0];
      
      if (!username) {
        throw new Error(`Invalid email format: ${dbAccount.email_address}`);
      }
      
      return {
        id: dbAccount.id,
        domain: dbAccount.domain_name,
        username,
        password: dbAccount.password_hash,
        fullEmail: dbAccount.email_address,
        quota: dbAccount.quota_mb ? dbAccount.quota_mb * 1024 * 1024 : undefined,
        enabled: dbAccount.is_active,
        createdAt: dbAccount.created_at,
        updatedAt: dbAccount.updated_at
      };
    });
  }

  async updateEmailAccount(id: number, updates: Partial<EmailAccount>): Promise<EmailAccount> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && value !== undefined) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    setClause.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE email_accounts 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async deleteEmailAccount(id: number): Promise<void> {
    const query = 'DELETE FROM email_accounts WHERE id = $1';
    await this.query(query, [id]);
  }

  // Email Storage
  async storeEmail(email: Omit<EmailMessage, 'id'>): Promise<EmailMessage> {
    // First get the domain_id for the domain
    const domainQuery = 'SELECT id FROM domains WHERE domain_name = $1';
    const domainResult = await this.query(domainQuery, [email.domain]);
    
    if (domainResult.rows.length === 0) {
      throw new Error(`Domain ${email.domain} not found`);
    }
    
    const domainId = domainResult.rows[0].id;
    
    const query = `
      INSERT INTO email_messages (
        domain_id, message_id, sender, recipients, cc_recipients, bcc_recipients,
        subject, body_text, body_html, headers, received_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const values = [
      domainId,
      email.messageId,
      email.from.address,
      email.to.map(addr => addr.address),
      email.cc?.map(addr => addr.address) || [],
      email.bcc?.map(addr => addr.address) || [],
      email.subject,
      email.text ?? null,
      email.html ?? null,
      JSON.stringify(email.headers ?? {}),
      email.receivedAt ?? new Date()
    ];

    const result = await this.query(query, values);
    return this.mapEmailFromDB(result.rows[0]);
  }

  async getEmailsByDomain(domain: string, limit = 50, offset = 0): Promise<EmailMessage[]> {
    const query = `
      SELECT em.*, d.domain_name 
      FROM email_messages em 
      JOIN domains d ON em.domain_id = d.id 
      WHERE d.domain_name = $1 
      ORDER BY em.received_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const result = await this.query(query, [domain, limit, offset]);
    return result.rows.map((row: any) => this.mapEmailFromDB(row));
  }

  async getEmailById(id: string): Promise<EmailMessage | null> {
    const query = `
      SELECT em.*, d.domain_name 
      FROM email_messages em 
      JOIN domains d ON em.domain_id = d.id 
      WHERE em.id = $1
    `;
    const result = await this.query(query, [id]);
    return result.rows[0] ? this.mapEmailFromDB(result.rows[0]) : null;
  }

  async searchEmails(domain: string, searchTerm: string, limit = 50): Promise<EmailMessage[]> {
    const query = `
      SELECT em.*, d.domain_name 
      FROM email_messages em 
      JOIN domains d ON em.domain_id = d.id 
      WHERE d.domain_name = $1 AND (
        em.subject ILIKE $2 OR 
        em.body_text ILIKE $2 OR 
        em.body_html ILIKE $2 OR
        em.sender ILIKE $2
      )
      ORDER BY em.received_at DESC 
      LIMIT $3
    `;
    const searchPattern = `%${searchTerm}%`;
    const result = await this.query(query, [domain, searchPattern, limit]);
    return result.rows.map((row: any) => this.mapEmailFromDB(row));
  }

  // Helper method to map database row to EmailMessage
  private mapEmailFromDB(row: any): EmailMessage {
    // Safely parse headers JSON
    let headers = {};
    try {
      headers = row.headers ? JSON.parse(row.headers) : {};
    } catch (error) {
      console.warn('Failed to parse email headers JSON, using empty object:', error);
      headers = {};
    }

    return {
      id: row.id,
      messageId: row.message_id,
      domain: row.domain_name,
      from: {
        address: row.sender,
        name: undefined // Not stored separately in the current schema
      },
      to: (row.recipients ?? []).map((addr: string) => ({ address: addr })),
      cc: (row.cc_recipients ?? []).map((addr: string) => ({ address: addr })),
      bcc: (row.bcc_recipients ?? []).map((addr: string) => ({ address: addr })),
      subject: row.subject,
      text: row.body_text,
      html: row.body_html,
      headers,
      sentAt: row.created_at, // Using created_at as sent time
      receivedAt: row.received_at
    };
  }

  // Statistics
  async getEmailStats(domain: string): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_emails,
        COUNT(*) FILTER (WHERE is_read = false) as unread_emails,
        MAX(received_at) as last_activity
      FROM email_messages em
      JOIN domains d ON em.domain_id = d.id
      WHERE d.domain_name = $1
    `;
    const result = await this.query(query, [domain]);
    
    const accountsQuery = `
      SELECT COUNT(*) as account_count 
      FROM email_accounts ea 
      JOIN domains d ON ea.domain_id = d.id 
      WHERE d.domain_name = $1 AND ea.is_active = true
    `;
    const accountsResult = await this.query(accountsQuery, [domain]);
    
    return {
      domain,
      totalEmails: parseInt(result.rows[0].total_emails),
      unreadEmails: parseInt(result.rows[0].unread_emails),
      accounts: parseInt(accountsResult.rows[0].account_count),
      lastActivity: result.rows[0].last_activity
    };
  }
}

// Export singleton instance
export const db = new DatabaseService();
