import type { Domain } from '../server.js'
import { db } from './database-service.js'

export class DomainService {
  // Get all domains from database
  async getAllDomains(): Promise<Domain[]> {
    if (!db.isConnected) {
      console.warn('⚠️ Database not connected - returning empty domains list');
      return [];
    }

    try {
      const query = 'SELECT * FROM domains ORDER BY created_at DESC';
      const result = await db.query(query);
      
      return result.rows.map((row: any) => ({
        domain: row.domain_name,
        smtp: {
          host: row.smtp_host,
          port: row.smtp_port,
          secure: row.smtp_secure
        },
        imap: {
          host: row.imap_host,
          port: row.imap_port,
          secure: row.imap_secure
        },
        accounts: [], // Will be populated separately if needed
        created: row.created_at,
        status: row.status
      }));
    } catch (error) {
      console.error('Error fetching domains from database:', error);
      return [];
    }
  }

  // Get single domain
  async getDomain(domainName: string): Promise<Domain | null> {
    if (!db.isConnected) {
      console.warn('⚠️ Database not connected');
      return null;
    }

    try {
      const query = 'SELECT * FROM domains WHERE domain_name = $1';
      const result = await db.query(query, [domainName]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        domain: row.domain_name,
        smtp: {
          host: row.smtp_host,
          port: row.smtp_port,
          secure: row.smtp_secure
        },
        imap: {
          host: row.imap_host,
          port: row.imap_port,
          secure: row.imap_secure
        },
        accounts: [], // Will be populated separately if needed
        created: row.created_at,
        status: row.status
      };
    } catch (error) {
      console.error('Error fetching domain from database:', error);
      return null;
    }
  }

  // Create new domain
  async createDomain(domainData: Domain): Promise<Domain> {
    if (!db.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        INSERT INTO domains (domain_name, smtp_host, smtp_port, smtp_secure, imap_host, imap_port, imap_secure, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const values = [
        domainData.domain,
        domainData.smtp.host,
        domainData.smtp.port,
        domainData.smtp.secure,
        domainData.imap.host,
        domainData.imap.port,
        domainData.imap.secure,
        domainData.status || 'active'
      ];

      const result = await db.query(query, values);
      const row = result.rows[0];

      console.log(`✅ Created domain: ${domainData.domain}`);

      return {
        domain: row.domain_name,
        smtp: {
          host: row.smtp_host,
          port: row.smtp_port,
          secure: row.smtp_secure
        },
        imap: {
          host: row.imap_host,
          port: row.imap_port,
          secure: row.imap_secure
        },
        accounts: [],
        created: row.created_at,
        status: row.status
      };
    } catch (error) {
      console.error('Error creating domain:', error);
      throw error;
    }
  }

  // Delete domain
  async deleteDomain(domainName: string): Promise<boolean> {
    if (!db.isConnected) {
      console.warn('⚠️ Database not connected');
      return false;
    }

    try {
      const query = 'DELETE FROM domains WHERE domain_name = $1';
      const result = await db.query(query, [domainName]);
      
      if (result.rowCount && result.rowCount > 0) {
        console.log(`🗑️ Deleted domain: ${domainName}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn(`Failed to delete domain ${domainName}:`, error);
      return false;
    }
  }

  // Update domain
  async updateDomain(domainName: string, updates: Partial<Domain>): Promise<Domain | null> {
    if (!db.isConnected) {
      console.warn('⚠️ Database not connected');
      return null;
    }

    try {
      const existingDomain = await this.getDomain(domainName);
      if (!existingDomain) {
        return null;
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.smtp) {
        if (updates.smtp.host !== undefined) {
          updateFields.push(`smtp_host = $${paramIndex++}`);
          values.push(updates.smtp.host);
        }
        if (updates.smtp.port !== undefined) {
          updateFields.push(`smtp_port = $${paramIndex++}`);
          values.push(updates.smtp.port);
        }
        if (updates.smtp.secure !== undefined) {
          updateFields.push(`smtp_secure = $${paramIndex++}`);
          values.push(updates.smtp.secure);
        }
      }

      if (updates.imap) {
        if (updates.imap.host !== undefined) {
          updateFields.push(`imap_host = $${paramIndex++}`);
          values.push(updates.imap.host);
        }
        if (updates.imap.port !== undefined) {
          updateFields.push(`imap_port = $${paramIndex++}`);
          values.push(updates.imap.port);
        }
        if (updates.imap.secure !== undefined) {
          updateFields.push(`imap_secure = $${paramIndex++}`);
          values.push(updates.imap.secure);
        }
      }

      if (updates.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }

      if (updateFields.length === 0) {
        return existingDomain; // No updates
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(domainName); // Add domain name for WHERE clause

      const query = `
        UPDATE domains 
        SET ${updateFields.join(', ')}
        WHERE domain_name = $${paramIndex}
        RETURNING *
      `;

      const result = await db.query(query, values);
      const row = result.rows[0];

      console.log(`📝 Updated domain: ${domainName}`);

      return {
        domain: row.domain_name,
        smtp: {
          host: row.smtp_host,
          port: row.smtp_port,
          secure: row.smtp_secure
        },
        imap: {
          host: row.imap_host,
          port: row.imap_port,
          secure: row.imap_secure
        },
        accounts: [],
        created: row.created_at,
        status: row.status
      };
    } catch (error) {
      console.error(`Failed to update domain ${domainName}:`, error);
      return null;
    }
  }

  // Get domain stats
  async getDomainStats(domainName: string): Promise<{ accountCount: number; emailCount: number } | null> {
    if (!db.isConnected) {
      return null;
    }

    try {
      const domain = await this.getDomain(domainName);
      if (!domain) {
        return null;
      }

      // Get domain ID first
      const domainIdQuery = 'SELECT id FROM domains WHERE domain_name = $1';
      const domainIdResult = await db.query(domainIdQuery, [domainName]);
      
      if (domainIdResult.rows.length === 0) {
        return null;
      }

      const domainId = domainIdResult.rows[0].id;

      // Get account count
      const accountQuery = 'SELECT COUNT(*) as count FROM email_accounts WHERE domain_id = $1 AND is_active = true';
      const accountResult = await db.query(accountQuery, [domainId]);

      // Get email count
      const emailQuery = 'SELECT COUNT(*) as count FROM email_messages WHERE domain_id = $1';
      const emailResult = await db.query(emailQuery, [domainId]);

      return {
        accountCount: parseInt(accountResult.rows[0].count),
        emailCount: parseInt(emailResult.rows[0].count)
      };
    } catch (error) {
      console.error(`Error getting domain stats for ${domainName}:`, error);
      return null;
    }
  }
}
