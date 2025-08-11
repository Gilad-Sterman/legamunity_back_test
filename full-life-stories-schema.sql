-- Full Life Stories Table Schema
-- This table stores generated full life stories with versioning and metadata

-- Create the full_life_stories table
CREATE TABLE IF NOT EXISTS full_life_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    
    -- Version management
    version INTEGER NOT NULL DEFAULT 1,
    previous_version_id UUID REFERENCES full_life_stories(id) ON DELETE SET NULL,
    is_current_version BOOLEAN DEFAULT true,
    
    -- Story content
    title TEXT NOT NULL,
    subtitle TEXT,
    content JSONB NOT NULL, -- Full story content with chapters, sections, etc.
    
    -- Generation metadata
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generated_by TEXT, -- User email or ID who generated it
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Source data metadata (snapshot at generation time)
    source_metadata JSONB NOT NULL DEFAULT '{}', -- Metadata about what was used to generate
    generation_stats JSONB NOT NULL DEFAULT '{}', -- Statistics about the generation
    
    -- Story statistics
    total_words INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0,
    estimated_reading_time INTEGER DEFAULT 0, -- in minutes
    
    -- Processing information
    processing_time INTEGER DEFAULT 0, -- in milliseconds
    ai_model TEXT DEFAULT 'mock-ai-v1.0',
    
    -- Status and workflow
    status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'reviewed', 'approved', 'published', 'archived')),
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Export and delivery
    export_formats JSONB DEFAULT '[]', -- Array of available export formats
    delivery_status JSONB DEFAULT '{}', -- Status of deliveries (PDF, print, etc.)
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_full_life_stories_session_id ON full_life_stories(session_id);
CREATE INDEX IF NOT EXISTS idx_full_life_stories_version ON full_life_stories(session_id, version);
CREATE INDEX IF NOT EXISTS idx_full_life_stories_current ON full_life_stories(session_id, is_current_version) WHERE is_current_version = true;
CREATE INDEX IF NOT EXISTS idx_full_life_stories_generated_at ON full_life_stories(generated_at);
CREATE INDEX IF NOT EXISTS idx_full_life_stories_status ON full_life_stories(status);
CREATE INDEX IF NOT EXISTS idx_full_life_stories_generated_by ON full_life_stories(generated_by);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_full_life_stories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_full_life_stories_updated_at
    BEFORE UPDATE ON full_life_stories
    FOR EACH ROW
    EXECUTE FUNCTION update_full_life_stories_updated_at();

-- Create function to manage versioning
CREATE OR REPLACE FUNCTION create_new_full_life_story_version(
    p_session_id UUID,
    p_title TEXT,
    p_subtitle TEXT,
    p_content JSONB,
    p_generated_by TEXT,
    p_user_id UUID,
    p_source_metadata JSONB,
    p_generation_stats JSONB,
    p_total_words INTEGER,
    p_processing_time INTEGER,
    p_ai_model TEXT
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_previous_version_id UUID;
    v_new_version INTEGER;
BEGIN
    -- Get the current version and mark it as not current
    SELECT id, version INTO v_previous_version_id, v_new_version
    FROM full_life_stories 
    WHERE session_id = p_session_id AND is_current_version = true
    ORDER BY version DESC 
    LIMIT 1;
    
    -- Update previous version to not be current
    IF v_previous_version_id IS NOT NULL THEN
        UPDATE full_life_stories 
        SET is_current_version = false 
        WHERE id = v_previous_version_id;
        
        v_new_version := v_new_version + 1;
    ELSE
        v_new_version := 1;
    END IF;
    
    -- Insert new version
    INSERT INTO full_life_stories (
        session_id,
        version,
        previous_version_id,
        is_current_version,
        title,
        subtitle,
        content,
        generated_by,
        user_id,
        source_metadata,
        generation_stats,
        total_words,
        total_pages,
        estimated_reading_time,
        processing_time,
        ai_model
    ) VALUES (
        p_session_id,
        v_new_version,
        v_previous_version_id,
        true,
        p_title,
        p_subtitle,
        p_content,
        p_generated_by,
        p_user_id,
        p_source_metadata,
        p_generation_stats,
        p_total_words,
        CEIL(p_total_words::DECIMAL / 250), -- ~250 words per page
        CEIL(p_total_words::DECIMAL / 200), -- ~200 words per minute reading
        p_processing_time,
        p_ai_model
    ) RETURNING id INTO v_new_id;
    
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies for security
ALTER TABLE full_life_stories ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role (backend) to perform all operations
CREATE POLICY full_life_stories_service_policy ON full_life_stories
    FOR ALL USING (
        auth.role() = 'service_role'
    );

-- Policy: Only admins can access full life stories (for authenticated users)
CREATE POLICY full_life_stories_admin_only_policy ON full_life_stories
    FOR ALL USING (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Alternative policy if you want to allow access based on session ownership
-- (Uncomment and modify based on your actual sessions table structure)
/*
CREATE POLICY full_life_stories_session_access_policy ON full_life_stories
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM sessions 
            WHERE user_id = auth.uid()
            -- Add other access conditions based on your sessions table structure
        )
    );
*/

-- Sample data for testing (optional)
-- This would be inserted after sessions exist
/*
INSERT INTO full_life_stories (
    session_id,
    title,
    subtitle,
    content,
    generated_by,
    source_metadata,
    generation_stats,
    total_words,
    processing_time
) VALUES (
    -- Replace with actual session ID
    '00000000-0000-0000-0000-000000000001',
    'The Life Story of John Doe',
    'A Comprehensive Journey Through 5 Life Interviews',
    '{
        "introduction": {"overview": "Sample introduction..."},
        "chapters": [
            {"title": "Early Life", "content": "Sample content..."}
        ],
        "appendices": {"interviewSummary": {"totalInterviews": 5}}
    }',
    'admin@example.com',
    '{
        "approvedDrafts": 3,
        "totalInterviews": 5,
        "completedInterviews": 4,
        "generationDate": "2025-01-11T13:43:46Z"
    }',
    '{
        "processingTime": 3500,
        "aiModel": "mock-ai-v1.0",
        "sourceInterviews": 3
    }',
    2500,
    3500
);
*/

-- Comments for documentation
COMMENT ON TABLE full_life_stories IS 'Stores generated full life stories with versioning and comprehensive metadata';
COMMENT ON COLUMN full_life_stories.version IS 'Version number, increments with each regeneration';
COMMENT ON COLUMN full_life_stories.previous_version_id IS 'Reference to the previous version for audit trail';
COMMENT ON COLUMN full_life_stories.is_current_version IS 'Only one version per session should be current';
COMMENT ON COLUMN full_life_stories.content IS 'Full story content in JSON format with chapters, sections, etc.';
COMMENT ON COLUMN full_life_stories.source_metadata IS 'Snapshot of source data at generation time (approved drafts, interviews, etc.)';
COMMENT ON COLUMN full_life_stories.generation_stats IS 'Statistics about the generation process';
COMMENT ON COLUMN full_life_stories.export_formats IS 'Array of available export formats (PDF, EPUB, etc.)';
COMMENT ON COLUMN full_life_stories.delivery_status IS 'Status of various delivery methods (email, print, etc.)';
