-- Create file_urls table to track uploaded files in Cloudinary
CREATE TABLE IF NOT EXISTS file_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  file_type VARCHAR(50) NOT NULL, -- 'audio', 'text', etc.
  original_filename VARCHAR(255) NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  cloudinary_url VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(interview_id, file_type)
);

-- Create index for faster lookups by interview_id
CREATE INDEX IF NOT EXISTS idx_file_urls_interview_id ON file_urls(interview_id);

-- Add comments for better documentation
COMMENT ON TABLE file_urls IS 'Stores information about files uploaded to Cloudinary for interviews';
COMMENT ON COLUMN file_urls.file_type IS 'Type of file: audio, text, etc.';
COMMENT ON COLUMN file_urls.cloudinary_public_id IS 'Cloudinary public ID for the uploaded file';
COMMENT ON COLUMN file_urls.cloudinary_url IS 'Full URL to access the file in Cloudinary';
