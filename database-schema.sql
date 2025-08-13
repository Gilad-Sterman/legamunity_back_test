-- Legamunity Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor to create the necessary tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== USERS TABLE ====================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== SESSIONS TABLE ====================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_name VARCHAR(255) NOT NULL,
    client_age INTEGER,
    client_email VARCHAR(255),
    client_phone VARCHAR(20),
    assigned_admin UUID REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INTERVIEWS TABLE ====================
CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'personal', 'career', 'relationships', 'life_events', 'wisdom'
    scheduled_date TIMESTAMP WITH TIME ZONE,
    completed_date TIMESTAMP WITH TIME ZONE,
    duration INTEGER DEFAULT 60, -- minutes
    location VARCHAR(100) DEFAULT 'online',
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'cancelled'
    content JSONB DEFAULT '{}', -- Interview responses and data
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== DRAFTS TABLE ====================
CREATE TABLE drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    stage VARCHAR(50) NOT NULL DEFAULT 'first_draft', -- 'first_draft', 'in_progress', 'pending_review', 'under_review', 'pending_approval', 'approved', 'rejected'
    content JSONB NOT NULL DEFAULT '{}',
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    overall_rating DECIMAL(3,2), -- 1.0 to 5.0
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, version)
);

-- ==================== DRAFT HISTORY TABLE ====================
CREATE TABLE draft_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draft_id UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'stage_changed', 'approved', 'rejected'
    user_id UUID REFERENCES users(id),
    changes JSONB DEFAULT '{}',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -- ==================== INDEXES ====================
-- CREATE INDEX idx_sessions_status ON sessions(status);
-- CREATE INDEX idx_sessions_assigned_admin ON sessions(assigned_admin);
-- CREATE INDEX idx_interviews_session_id ON interviews(session_id);
-- CREATE INDEX idx_interviews_status ON interviews(status);
-- CREATE INDEX idx_interviews_type ON interviews(type);
-- CREATE INDEX idx_drafts_session_id ON drafts(session_id);
-- CREATE INDEX idx_drafts_stage ON drafts(stage);
-- CREATE INDEX idx_draft_history_draft_id ON draft_history(draft_id);
-- CREATE INDEX idx_draft_history_action ON draft_history(action);

-- -- ==================== ROW LEVEL SECURITY (RLS) ====================
-- -- Enable RLS on all tables
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE draft_history ENABLE ROW LEVEL SECURITY;

-- -- Create policies (for now, allow all operations - you can restrict later)
-- CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on sessions" ON sessions FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on interviews" ON interviews FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on drafts" ON drafts FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on draft_history" ON draft_history FOR ALL USING (true);

-- -- ==================== SAMPLE DATA ====================
-- -- Insert sample users
-- INSERT INTO users (name, email, role, phone) VALUES
-- ('Admin User', 'admin@legamunity.com', 'admin', '+1-555-0101'),
-- ('Sarah Johnson', 'sarah@legamunity.com', 'admin', '+1-555-0102'),
-- ('Michael Chen', 'michael@legamunity.com', 'admin', '+1-555-0103');

-- -- Insert sample session
-- INSERT INTO sessions (client_name, client_age, client_email, client_phone, assigned_admin, status) 
-- SELECT 
--     'Eleanor Thompson', 
--     78, 
--     'eleanor.thompson@email.com', 
--     '+1-555-0201',
--     u.id,
--     'active'
-- FROM users u WHERE u.email = 'admin@legamunity.com';

-- -- Insert sample interviews
-- INSERT INTO interviews (session_id, type, scheduled_date, status, duration, location)
-- SELECT 
--     s.id,
--     'personal',
--     NOW() + INTERVAL '1 day',
--     'scheduled',
--     90,
--     'online'
-- FROM sessions s WHERE s.client_name = 'Eleanor Thompson';

-- INSERT INTO interviews (session_id, type, scheduled_date, status, duration, location)
-- SELECT 
--     s.id,
--     'career',
--     NOW() + INTERVAL '3 days',
--     'scheduled',
--     75,
--     'online'
-- FROM sessions s WHERE s.client_name = 'Eleanor Thompson';

-- -- ==================== FUNCTIONS ====================
-- -- Function to update updated_at timestamp
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = NOW();
--     RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- -- Create triggers for updated_at
-- CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON interviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- CREATE TRIGGER update_drafts_updated_at BEFORE UPDATE ON drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Full Life Stories Table Schema
-- This table stores generated full life stories with versioning and metadata

-- Create the full_life_stories table
-- CREATE TABLE IF NOT EXISTS full_life_stories (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    
--     -- Version management
--     version INTEGER NOT NULL DEFAULT 1,
--     previous_version_id UUID REFERENCES full_life_stories(id) ON DELETE SET NULL,
--     is_current_version BOOLEAN DEFAULT true,
    
--     -- Story content
--     title TEXT NOT NULL,
--     subtitle TEXT,
--     content JSONB NOT NULL, -- Full story content with chapters, sections, etc.
    
--     -- Generation metadata
--     generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     generated_by TEXT, -- User email or ID who generated it
--     user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
--     -- Source data metadata (snapshot at generation time)
--     source_metadata JSONB NOT NULL DEFAULT '{}', -- Metadata about what was used to generate
--     generation_stats JSONB NOT NULL DEFAULT '{}', -- Statistics about the generation
    
--     -- Story statistics
--     total_words INTEGER DEFAULT 0,
--     total_pages INTEGER DEFAULT 0,
--     estimated_reading_time INTEGER DEFAULT 0, -- in minutes
    
--     -- Processing information
--     processing_time INTEGER DEFAULT 0, -- in milliseconds
--     ai_model TEXT DEFAULT 'mock-ai-v1.0',
    
--     -- Status and workflow
--     status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'reviewed', 'approved', 'published', 'archived')),
--     review_notes TEXT,
--     reviewed_by TEXT,
--     reviewed_at TIMESTAMP WITH TIME ZONE,
    
--     -- Export and delivery
--     export_formats JSONB DEFAULT '[]', -- Array of available export formats
--     delivery_status JSONB DEFAULT '{}', -- Status of deliveries (PDF, print, etc.)
    
--     -- Timestamps
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- -- Create indexes for performance
-- CREATE INDEX IF NOT EXISTS idx_full_life_stories_session_id ON full_life_stories(session_id);
-- CREATE INDEX IF NOT EXISTS idx_full_life_stories_version ON full_life_stories(session_id, version);
-- CREATE INDEX IF NOT EXISTS idx_full_life_stories_current ON full_life_stories(session_id, is_current_version) WHERE is_current_version = true;
-- CREATE INDEX IF NOT EXISTS idx_full_life_stories_generated_at ON full_life_stories(generated_at);
-- CREATE INDEX IF NOT EXISTS idx_full_life_stories_status ON full_life_stories(status);
-- CREATE INDEX IF NOT EXISTS idx_full_life_stories_generated_by ON full_life_stories(generated_by);

-- -- Create trigger to update updated_at timestamp
-- CREATE OR REPLACE FUNCTION update_full_life_stories_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = NOW();
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trigger_update_full_life_stories_updated_at
--     BEFORE UPDATE ON full_life_stories
--     FOR EACH ROW
--     EXECUTE FUNCTION update_full_life_stories_updated_at();

-- -- Create function to manage versioning
-- CREATE OR REPLACE FUNCTION create_new_full_life_story_version(
--     p_session_id UUID,
--     p_title TEXT,
--     p_subtitle TEXT,
--     p_content JSONB,
--     p_generated_by TEXT,
--     p_user_id UUID,
--     p_source_metadata JSONB,
--     p_generation_stats JSONB,
--     p_total_words INTEGER,
--     p_processing_time INTEGER,
--     p_ai_model TEXT
-- )
-- RETURNS UUID AS $$
-- DECLARE
--     v_new_id UUID;
--     v_previous_version_id UUID;
--     v_new_version INTEGER;
-- BEGIN
--     -- Get the current version and mark it as not current
--     SELECT id, version INTO v_previous_version_id, v_new_version
--     FROM full_life_stories 
--     WHERE session_id = p_session_id AND is_current_version = true
--     ORDER BY version DESC 
--     LIMIT 1;
    
--     -- Update previous version to not be current
--     IF v_previous_version_id IS NOT NULL THEN
--         UPDATE full_life_stories 
--         SET is_current_version = false 
--         WHERE id = v_previous_version_id;
        
--         v_new_version := v_new_version + 1;
--     ELSE
--         v_new_version := 1;
--     END IF;
    
--     -- Insert new version
--     INSERT INTO full_life_stories (
--         session_id,
--         version,
--         previous_version_id,
--         is_current_version,
--         title,
--         subtitle,
--         content,
--         generated_by,
--         user_id,
--         source_metadata,
--         generation_stats,
--         total_words,
--         total_pages,
--         estimated_reading_time,
--         processing_time,
--         ai_model
--     ) VALUES (
--         p_session_id,
--         v_new_version,
--         v_previous_version_id,
--         true,
--         p_title,
--         p_subtitle,
--         p_content,
--         p_generated_by,
--         p_user_id,
--         p_source_metadata,
--         p_generation_stats,
--         p_total_words,
--         CEIL(p_total_words::DECIMAL / 250), -- ~250 words per page
--         CEIL(p_total_words::DECIMAL / 200), -- ~200 words per minute reading
--         p_processing_time,
--         p_ai_model
--     ) RETURNING id INTO v_new_id;
    
--     RETURN v_new_id;
-- END;
-- $$ LANGUAGE plpgsql;

-- -- Create RLS policies for security
-- ALTER TABLE full_life_stories ENABLE ROW LEVEL SECURITY;

-- -- Policy: Allow service role (backend) to perform all operations
-- CREATE POLICY full_life_stories_service_policy ON full_life_stories
--     FOR ALL USING (
--         auth.role() = 'service_role'
--     );

-- -- Policy: Only admins can access full life stories (for authenticated users)
-- CREATE POLICY full_life_stories_admin_only_policy ON full_life_stories
--     FOR ALL USING (
--         auth.role() = 'authenticated' AND
--         EXISTS (
--             SELECT 1 FROM users 
--             WHERE id = auth.uid() 
--             AND role = 'admin'
--         )
--     );

-- -- Alternative policy if you want to allow access based on session ownership
-- -- (Uncomment and modify based on your actual sessions table structure)
-- /*
-- CREATE POLICY full_life_stories_session_access_policy ON full_life_stories
--     FOR SELECT USING (
--         session_id IN (
--             SELECT id FROM sessions 
--             WHERE user_id = auth.uid()
--             -- Add other access conditions based on your sessions table structure
--         )
--     );
-- */

-- -- Sample data for testing (optional)
-- -- This would be inserted after sessions exist
-- /*
-- INSERT INTO full_life_stories (
--     session_id,
--     title,
--     subtitle,
--     content,
--     generated_by,
--     source_metadata,
--     generation_stats,
--     total_words,
--     processing_time
-- ) VALUES (
--     -- Replace with actual session ID
--     '00000000-0000-0000-0000-000000000001',
--     'The Life Story of John Doe',
--     'A Comprehensive Journey Through 5 Life Interviews',
--     '{
--         "introduction": {"overview": "Sample introduction..."},
--         "chapters": [
--             {"title": "Early Life", "content": "Sample content..."}
--         ],
--         "appendices": {"interviewSummary": {"totalInterviews": 5}}
--     }',
--     'admin@example.com',
--     '{
--         "approvedDrafts": 3,
--         "totalInterviews": 5,
--         "completedInterviews": 4,
--         "generationDate": "2025-01-11T13:43:46Z"
--     }',
--     '{
--         "processingTime": 3500,
--         "aiModel": "mock-ai-v1.0",
--         "sourceInterviews": 3
--     }',
--     2500,
--     3500
-- );
-- */

-- -- Comments for documentation
-- COMMENT ON TABLE full_life_stories IS 'Stores generated full life stories with versioning and comprehensive metadata';
-- COMMENT ON COLUMN full_life_stories.version IS 'Version number, increments with each regeneration';
-- COMMENT ON COLUMN full_life_stories.previous_version_id IS 'Reference to the previous version for audit trail';
-- COMMENT ON COLUMN full_life_stories.is_current_version IS 'Only one version per session should be current';
-- COMMENT ON COLUMN full_life_stories.content IS 'Full story content in JSON format with chapters, sections, etc.';
-- COMMENT ON COLUMN full_life_stories.source_metadata IS 'Snapshot of source data at generation time (approved drafts, interviews, etc.)';
-- COMMENT ON COLUMN full_life_stories.generation_stats IS 'Statistics about the generation process';
-- COMMENT ON COLUMN full_life_stories.export_formats IS 'Array of available export formats (PDF, EPUB, etc.)';
-- COMMENT ON COLUMN full_life_stories.delivery_status IS 'Status of various delivery methods (email, print, etc.)';