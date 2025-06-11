// Email type definitions for our multi-domain email server
// All types are completely domain-agnostic

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}

export interface EmailMessage {
  id?: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  domain: string; // Which domain this email belongs to
  sentAt?: Date;
  receivedAt?: Date;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
}

export interface EmailAccount {
  id?: number;
  domain: string;
  username: string; // Local part (before @)
  password: string; // Hashed
  fullEmail: string; // Complete email address
  quota?: number; // In bytes
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EmailFolder {
  name: string;
  path: string;
  delimiter: string;
  flags: string[];
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

export interface IMAPConfig {
  host: string;
  port: number;
  tls: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailServiceConfig {
  domain: string;
  smtp: SMTPConfig;
  imap: IMAPConfig;
}

export interface SendEmailRequest {
  from: string; // Email address
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface FetchEmailsRequest {
  folder?: string; // Default: INBOX
  limit?: number; // Default: 50
  offset?: number; // Default: 0
  since?: Date;
  unseen?: boolean; // Only unread emails
}

export interface FetchEmailsResponse {
  success: boolean;
  emails: EmailMessage[];
  total: number;
  error?: string;
}

export interface EmailStats {
  domain: string;
  totalEmails: number;
  unreadEmails: number;
  sentEmails: number;
  accounts: number;
  lastActivity?: Date;
}
