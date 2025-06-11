// Email service for SMTP/IMAP operations
// Completely domain-agnostic with configurable connections

import nodemailer from 'nodemailer';
import Imap from 'imap';
import type { 
  EmailMessage, 
  SendEmailRequest, 
  SendEmailResponse,
  FetchEmailsRequest,
  FetchEmailsResponse,
  SMTPConfig,
  IMAPConfig
} from '../types/email.js';
import { db } from './database-service.js';

export class EmailService {
  private readonly smtpTransporters: Map<string, nodemailer.Transporter> = new Map();
  private readonly imapConnections: Map<string, Imap> = new Map();

  // Get SMTP configuration for a domain
  private getSMTPConfig(domain: string): SMTPConfig {
    // Use port 25 for internal Docker network connections
    // Port 25 is more permissive for internal networks than submission port
    return {
      host: process.env.SMTP_HOST ?? 'postfix',
      port: parseInt(process.env.SMTP_PORT ?? '25'), // Use port 25 for internal connections
      secure: false, // No TLS needed for internal connections
      // No auth needed for internal Docker network connections (permit_mynetworks)
    };
  }

  // Get IMAP configuration for a specific user
  private async getIMAPConfig(emailAccount: string): Promise<IMAPConfig> {
    // Get the user's password from the database
    const account = await db.getEmailAccount(emailAccount);
    if (!account) {
      throw new Error(`Email account ${emailAccount} not found`);
    }

    // Extract domain from email account
    const domain = emailAccount.split('@')[1];
    if (!domain) {
      throw new Error(`Invalid email format: ${emailAccount}`);
    }
    
    // Get domain configuration from database
    const domainConfig = await db.getDomain(domain);
    if (!domainConfig) {
      throw new Error(`Domain ${domain} not found`);
    }

    return {
      host: domainConfig.imap_host,
      port: domainConfig.imap_port,
      tls: domainConfig.imap_secure,
      auth: {
        user: emailAccount,
        pass: account.password // Use the actual password from database
      }
    };
  }

  // Get or create SMTP transporter for a domain
  private async getSMTPTransporter(domain: string): Promise<nodemailer.Transporter> {
    if (!this.smtpTransporters.has(domain)) {
      const config = this.getSMTPConfig(domain);
      const transporterOptions: any = {
        host: config.host,
        port: config.port,
        secure: config.secure,
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000, // 10 seconds  
        socketTimeout: 10000, // 10 seconds
        tls: {
          rejectUnauthorized: false // For development/self-signed certificates
        },
        debug: true, // Enable debug logging
        logger: true // Enable logging
      };

      // Only add auth if it's provided
      if (config.auth) {
        transporterOptions.auth = config.auth;
      }

      const transporter = nodemailer.createTransport(transporterOptions);

      // Test the connection to make sure it works
      console.log(`🔍 Testing SMTP connection for domain: ${domain} (${config.host}:${config.port})`);
      try {
        await transporter.verify();
        console.log(`✅ SMTP connection verified for domain: ${domain}`);
      } catch (error) {
        console.log(`⚠️ SMTP verification failed for domain: ${domain}, but continuing anyway:`, error);
      }
      
      this.smtpTransporters.set(domain, transporter);
    }

    return this.smtpTransporters.get(domain)!;
  }

  // Get or create IMAP connection for a specific user
  private async getIMAPConnection(emailAccount: string): Promise<Imap> {
    if (!this.imapConnections.has(emailAccount)) {
      const config = await this.getIMAPConfig(emailAccount);
      console.log(`🔧 IMAP Config for ${emailAccount}: host=${config.host}, port=${config.port}, tls=${config.tls}`);
      
      const imap = new Imap({
        user: config.auth.user,
        password: config.auth.pass,
        host: config.host,
        port: config.port,
        tls: config.tls,
        tlsOptions: {
          rejectUnauthorized: false // For development/self-signed certificates
        }
      });

      this.imapConnections.set(emailAccount, imap);
    }

    return this.imapConnections.get(emailAccount)!;
  }

  // Send email
  async sendEmail(domain: string, emailRequest: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      console.log(`🔍 Starting email send process for domain: ${domain}, from: ${emailRequest.from}`);
      
      // Validate sender account exists
      console.log(`🔍 Validating sender account: ${emailRequest.from}`);
      const senderAccount = await db.getEmailAccount(emailRequest.from);
      if (!senderAccount) {
        console.log(`❌ Sender account not found: ${emailRequest.from}`);
        return {
          success: false,
          error: `Sender account ${emailRequest.from} not found or disabled`
        };
      }
      console.log(`✅ Sender account validated: ${senderAccount.username}`);

      // Get SMTP transporter for this domain
      console.log(`🔍 Getting SMTP transporter for domain: ${domain}`);
      const transporter = await this.getSMTPTransporter(domain);
      console.log(`✅ SMTP transporter ready for domain: ${domain}`);

      // Prepare email options
      console.log(`🔍 Preparing email options...`);
      const mailOptions = {
        from: `${senderAccount.username} <${emailRequest.from}>`,
        to: emailRequest.to.join(', '),
        cc: emailRequest.cc?.join(', '),
        bcc: emailRequest.bcc?.join(', '),
        subject: emailRequest.subject,
        text: emailRequest.text,
        html: emailRequest.html,
        attachments: emailRequest.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType
        }))
      };
      console.log(`✅ Email options prepared for: ${mailOptions.to}`);

      // Send the email
      console.log(`🔍 Sending email via SMTP...`);
      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent via SMTP, messageId: ${result.messageId}`);

      // Store email in database
      const emailMessage: Omit<EmailMessage, 'id'> = {
        messageId: result.messageId,
        domain,
        from: { address: emailRequest.from },
        to: emailRequest.to.map(addr => ({ address: addr })),
        cc: emailRequest.cc?.map(addr => ({ address: addr })) || [],
        bcc: emailRequest.bcc?.map(addr => ({ address: addr })) || [],
        subject: emailRequest.subject,
        text: emailRequest.text,
        html: emailRequest.html,
        sentAt: new Date()
      };

      await db.storeEmail(emailMessage);

      console.log(`✅ Email sent successfully from ${emailRequest.from} via domain ${domain}`);
      
      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      console.error(`❌ Failed to send email via domain ${domain}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Fetch emails from IMAP
  async fetchEmails(domain: string, emailAccount: string, fetchRequest: FetchEmailsRequest): Promise<FetchEmailsResponse> {
    try {
      console.log(`🔍 Starting IMAP fetch for ${emailAccount} in domain ${domain}`);
      
      // Validate account exists
      const account = await db.getEmailAccount(emailAccount);
      if (!account) {
        console.log(`❌ Account ${emailAccount} not found in database`);
        return {
          success: false,
          emails: [],
          total: 0,
          error: `Email account ${emailAccount} not found or disabled`
        };
      }
      console.log(`✅ Account ${emailAccount} found, password: ${account.password.substring(0, 3)}...`);

      // Get IMAP connection
      console.log(`🔍 Getting IMAP connection for ${emailAccount}...`);
      const imap = await this.getIMAPConnection(emailAccount);
      console.log(`✅ IMAP connection object created for ${emailAccount}`);

      return new Promise((resolve, reject) => {
        const emails: EmailMessage[] = [];
        let timeoutId: NodeJS.Timeout;

        // Set a timeout for the IMAP operation
        timeoutId = setTimeout(() => {
          console.log(`⏰ IMAP operation timed out for ${emailAccount}`);
          imap.end();
          resolve({
            success: false,
            emails: [],
            total: 0,
            error: `IMAP operation timed out after 30 seconds`
          });
        }, 30000); // 30 second timeout

        imap.once('ready', () => {
          console.log(`🔗 IMAP ready event fired for ${emailAccount}`);
          imap.openBox(fetchRequest.folder ?? 'INBOX', true, (err, box) => {
            if (err) {
              console.log(`❌ Failed to open mailbox for ${emailAccount}:`, err.message);
              clearTimeout(timeoutId);
              resolve({
                success: false,
                emails: [],
                total: 0,
                error: `Failed to open mailbox: ${err.message}`
              });
              return;
            }

            console.log(`✅ Mailbox opened for ${emailAccount}, message count: ${box.messages.total}`);

            const searchCriteria: string[] = fetchRequest.unseen ? ['UNSEEN'] : ['ALL'];
            if (fetchRequest.since) {
              searchCriteria.push('SINCE', fetchRequest.since.toDateString());
            }

            console.log(`🔍 Searching with criteria: ${JSON.stringify(searchCriteria)}`);

            imap.search(searchCriteria, (err, results) => {
              if (err) {
                console.log(`❌ IMAP search failed for ${emailAccount}:`, err.message);
                clearTimeout(timeoutId);
                resolve({
                  success: false,
                  emails: [],
                  total: 0,
                  error: `Failed to search emails: ${err.message}`
                });
                return;
              }

              console.log(`📧 Search found ${results?.length || 0} messages for ${emailAccount}`);

              if (!results || results.length === 0) {
                clearTimeout(timeoutId);
                resolve({
                  success: true,
                  emails: [],
                  total: 0
                });
                return;
              }

              // Apply pagination
              const offset = fetchRequest.offset ?? 0;
              const limit = fetchRequest.limit ?? 50;
              const paginatedResults = results.slice(offset, offset + limit);

              console.log(`📄 Fetching ${paginatedResults.length} messages (offset: ${offset}, limit: ${limit})`);

              const fetch = imap.fetch(paginatedResults, {
                bodies: 'HEADER.FIELDS (FROM TO CC BCC SUBJECT DATE MESSAGE-ID)',
                struct: true
              });

              fetch.on('message', (msg, seqno) => {
                console.log(`📨 Processing message ${seqno}`);
                const email: Partial<EmailMessage> = { domain };

                msg.on('body', (stream, info) => {
                  let buffer = '';
                  stream.on('data', (chunk) => {
                    buffer += chunk.toString('ascii');
                  });
                  stream.once('end', () => {
                    // Parse email headers
                    const headers = Imap.parseHeader(buffer);
                    email.from = { address: headers.from?.[0] ?? '' };
                    email.to = (headers.to || []).map(addr => ({ address: addr }));
                    email.cc = (headers.cc || []).map(addr => ({ address: addr }));
                    email.bcc = (headers.bcc || []).map(addr => ({ address: addr }));
                    email.subject = headers.subject?.[0] ?? '';
                    email.messageId = headers['message-id']?.[0];
                    email.receivedAt = new Date(headers.date?.[0] ?? Date.now());
                    console.log(`✅ Parsed email: ${email.subject}`);
                  });
                });

                msg.once('end', () => {
                  emails.push(email as EmailMessage);
                });
              });

              fetch.once('error', (err) => {
                console.log(`❌ IMAP fetch error for ${emailAccount}:`, err.message);
                clearTimeout(timeoutId);
                resolve({
                  success: false,
                  emails: [],
                  total: 0,
                  error: `Failed to fetch emails: ${err.message}`
                });
              });

              fetch.once('end', () => {
                console.log(`✅ IMAP fetch completed for ${emailAccount}, found ${emails.length} emails`);
                clearTimeout(timeoutId);
                imap.end();
                resolve({
                  success: true,
                  emails,
                  total: results.length
                });
              });
            });
          });
        });

        imap.once('error', (err: Error) => {
          console.log(`❌ IMAP connection error for ${emailAccount}:`, err.message);
          clearTimeout(timeoutId);
          resolve({
            success: false,
            emails: [],
            total: 0,
            error: `IMAP connection failed: ${err.message}`
          });
        });

        console.log(`🔗 Attempting IMAP connection for ${emailAccount}...`);
        imap.connect();
      });

    } catch (error) {
      console.error(`❌ Failed to fetch emails for domain ${domain}:`, error);
      return {
        success: false,
        emails: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Sync emails from IMAP server
  async syncEmailsFromIMAP(domain: string, emailAccount: string): Promise<FetchEmailsResponse> {
    // For now, just use the same fetchEmails method
    return this.fetchEmails(domain, emailAccount, { limit: 100 });
  }

  // Test connectivity to email servers  
  async testConnectivity(domain: string, emailAccount?: string): Promise<{smtp: boolean, imap: boolean}> {
    const result = { smtp: false, imap: false };
    
    try {
      // Test SMTP
      const transporter = await this.getSMTPTransporter(domain);
      await transporter.verify();
      result.smtp = true;
    } catch (error) {
      console.log(`SMTP connectivity test failed for ${domain}:`, error);
    }
    
    if (emailAccount) {
      try {
        // Test IMAP connection with specific account
        const imap = await this.getIMAPConnection(emailAccount);
        await new Promise<void>((resolve, reject) => {
          imap.once('ready', () => {
            imap.end();
            resolve();
          });
          imap.once('error', reject);
          imap.connect();
        });
        result.imap = true;
      } catch (error) {
        console.log(`IMAP connectivity test failed for ${emailAccount}:`, error);
      }
    }
    
    return result;
  }

  // Clean up connections
  async cleanup(): Promise<void> {
    // Close SMTP transporters
    for (const [domain, transporter] of this.smtpTransporters) {
      try {
        transporter.close();
        console.log(`✅ Closed SMTP transporter for domain: ${domain}`);
      } catch (error) {
        console.error(`Failed to close SMTP transporter for domain ${domain}:`, error);
      }
    }
    this.smtpTransporters.clear();

    // Close IMAP connections
    for (const [emailAccount, imap] of this.imapConnections) {
      try {
        imap.end();
        console.log(`✅ Closed IMAP connection for email account: ${emailAccount}`);
      } catch (error) {
        console.error(`Failed to close IMAP connection for email account ${emailAccount}:`, error);
      }
    }
    this.imapConnections.clear();
  }
}

// Export singleton instance
export const emailService = new EmailService();
