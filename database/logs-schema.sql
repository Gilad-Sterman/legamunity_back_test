-- Logs table for tracking system events and user actions
-- This table will store all important events in the application

CREATE TABLE IF NOT EXISTS logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'auth', 'session', 'interview', 'file', 'draft', 'error', 'system'
    event_action VARCHAR(50) NOT NULL, -- 'login', 'logout', 'created', 'updated', 'deleted', 'uploaded', 'generated', 'error'
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email VARCHAR(255), -- Store email for reference even if user is deleted
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    interview_id VARCHAR(255), -- Store as string since interviews use custom IDs, not UUIDs
    resource_id UUID, -- Generic ID for any other resource (draft, file, etc.)
    resource_type VARCHAR(50), -- Type of resource if resource_id is used
    event_data JSONB, -- Additional event-specific data
    ip_address INET,
    user_agent TEXT,
    error_message TEXT, -- For error events
    error_stack TEXT, -- For detailed error tracking
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB -- Additional metadata for the event
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_logs_event_type ON logs(event_type);
CREATE INDEX IF NOT EXISTS idx_logs_event_action ON logs(event_action);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_session_id ON logs(session_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_severity ON logs(severity);
CREATE INDEX IF NOT EXISTS idx_logs_user_email ON logs(user_email);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_logs_user_event ON logs(user_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_session_events ON logs(session_id, event_type, created_at);

-- RLS (Row Level Security) policies
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own logs (admins can see all)
CREATE POLICY "Users can view own logs" ON logs
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Policy: Allow service role and authenticated users to insert logs
CREATE POLICY "Service and authenticated users can insert logs" ON logs
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        auth.role() = 'authenticated'
    );

-- Policy: No updates or deletes allowed (logs are immutable)
CREATE POLICY "No updates allowed" ON logs FOR UPDATE USING (false);
CREATE POLICY "No deletes allowed" ON logs FOR DELETE USING (false);

-- Function to automatically clean up old logs (optional - keep last 6 months)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM logs 
    WHERE created_at < NOW() - INTERVAL '6 months'
    AND severity IN ('info', 'warning'); -- Keep errors and critical logs longer
END;
$$ LANGUAGE plpgsql;

-- Sample log entries for testing
INSERT INTO logs (event_type, event_action, user_email, event_data, severity) VALUES
('system', 'startup', 'system@legamunity.com', '{"version": "1.0.0", "environment": "development"}', 'info'),
('auth', 'login', 'admin@example.com', '{"login_method": "email", "success": true}', 'info'),
('session', 'created', 'admin@example.com', '{"client_name": "John Doe", "priority": "high"}', 'info'),
('error', 'validation', 'admin@example.com', '{"field": "email", "message": "Invalid email format"}', 'warning');

-- Comments for documentation
COMMENT ON TABLE logs IS 'System-wide event logging table for audit trail and monitoring';
COMMENT ON COLUMN logs.event_type IS 'Category of event: auth, session, interview, file, draft, error, system';
COMMENT ON COLUMN logs.event_action IS 'Specific action: login, logout, created, updated, deleted, uploaded, generated, error';
COMMENT ON COLUMN logs.event_data IS 'JSON data specific to the event type';
COMMENT ON COLUMN logs.severity IS 'Event severity level: info, warning, error, critical';
COMMENT ON COLUMN logs.metadata IS 'Additional metadata for the event';
