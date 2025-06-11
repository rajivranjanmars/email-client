-- PostgreSQL Database Schema for Multi-Domain Email Server
-- This schema is completely generic - no hardcoded domain references

-- Domains table
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name VARCHAR(255) UNIQUE NOT NULL,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_secure BOOLEAN NOT NULL DEFAULT true,
    imap_host VARCHAR(255) NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_secure BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settings JSONB DEFAULT '{}'::jsonb
);

-- Email accounts table
CREATE TABLE IF NOT EXISTS email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    email_address VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    quota_mb INTEGER DEFAULT 1024,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}'::jsonb
);

-- Email messages table
CREATE TABLE IF NOT EXISTS email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    thread_id VARCHAR(255),
    sender VARCHAR(255) NOT NULL,
    recipients TEXT[] NOT NULL,
    cc_recipients TEXT[],
    bcc_recipients TEXT[],
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    headers JSONB DEFAULT '{}'::jsonb,
    size_bytes INTEGER,
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_starred BOOLEAN NOT NULL DEFAULT false,
    is_spam BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    folder VARCHAR(100) DEFAULT 'INBOX',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email folders table
CREATE TABLE IF NOT EXISTS email_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES email_folders(id) ON DELETE CASCADE,
    message_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, name, parent_id)
);

-- Email filters table
CREATE TABLE IF NOT EXISTS email_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API keys table for authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
    account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_domains_name ON domains(domain_name);
CREATE INDEX IF NOT EXISTS idx_email_accounts_domain ON email_accounts(domain_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_email ON email_accounts(email_address);
CREATE INDEX IF NOT EXISTS idx_email_messages_domain ON email_messages(domain_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_account ON email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_received ON email_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_folder ON email_messages(folder);
CREATE INDEX IF NOT EXISTS idx_email_folders_account ON email_folders(account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_domain ON api_keys(domain_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_domain ON audit_logs(domain_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_domains_updated_at BEFORE UPDATE ON domains FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON email_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default folders for new accounts
CREATE OR REPLACE FUNCTION create_default_folders()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO email_folders (account_id, name) VALUES
        (NEW.id, 'INBOX'),
        (NEW.id, 'Sent'),
        (NEW.id, 'Drafts'),
        (NEW.id, 'Trash'),
        (NEW.id, 'Spam');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_default_folders_trigger AFTER INSERT ON email_accounts FOR EACH ROW EXECUTE FUNCTION create_default_folders();
